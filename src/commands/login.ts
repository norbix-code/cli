import {Flags} from '@oclif/core'

import {BaseCommand, projectLabel, projectLines, type GlobalFlags, type ResolvedContext} from '../base.js'
import {CliError, usageError} from '../lib/cli-error.js'
import {
  DeviceFlowUnsupportedError,
  canOpenBrowser,
  deviceName,
  expiredError,
  openBrowser,
  pollDeviceToken,
  pollDeviceTokenUntil,
  startDeviceFlow,
  type DeviceTokenSuccess,
} from '../lib/device-login.js'
import {EXIT} from '../lib/exit-codes.js'
import {DEFAULT_HOST, cachedHost, hostKey, normalizeHost, storedHost} from '../lib/hosts.js'
import {type HubEndpoint} from '../lib/hub-version.js'
import {
  clearPending,
  listPendingKeys,
  parseSessionKey,
  readPending,
  readProfiles,
  sessionKey,
  sessionPath,
  writePending,
  writeProfile,
  writeSession,
  type PendingSignIn,
} from '../lib/profiles.js'

/** `login --wait` polls at most this long per run; a coding agent's shell command times out at ~2 min. */
export const WAIT_SLICE_MS = 90_000

export default class Login extends BaseCommand {
  static description = `Log in to Norbix.

Default: browser sign-in. The CLI shows a one-time code and opens the
Norbix dashboard; you sign in there, pick the roles the CLI gets, and press
Allow. The CLI then works as an AI service user named "Norbix CLI
(<this computer>)" with exactly those roles — never more than you have. You
can remove it any time in the dashboard under Account → AI service users.

Which Norbix: --host (or NORBIX_HOST, or \`host\` in the --profile) names
your dashboard or Hub, e.g. cloud.example.com; the default is hub.norbix.ai.
The Hub tells the CLI every other address.

Which project: --project (or NORBIX_PROJECT_ID), else the project_id of the
profile (--profile / NORBIX_PROFILE, else [default]). The Hub pins the
sign-in to that project, so it is saved per Hub AND project:
~/.norbix/sessions/<hub>@<project>.json. A sign-in for another project on
the same Hub stays as it is — several projects can be signed in at once,
and every command uses the sign-in of the project it is for (its --project
or profile). With no project named the sign-in is saved to
~/.norbix/sessions/<hub>.json. The access token lasts one hour and is
refreshed by itself; when the sign-in is removed or runs out, the next
command asks you to log in again (exit 4).

Over SSH, in a container, or with --no-browser the CLI never opens a
browser: it prints the link — open it on any device, sign in there, and the
CLI picks the sign-in up by itself.

Coding agents (their shell commands time out after ~2 minutes; the code
lives 10 minutes) sign in in two steps:
  norbix login --no-browser --json   starts the sign-in, prints
                                     {userCode, verificationUriComplete,
                                     expiresIn} and exits at once
  norbix login --wait                waits up to 90 s for the approval;
                                     run it again until it is approved
                                     (exit 0), denied or expired (exit 4)

--api-key  saves a long-lived service-user key (and --host) into a profile
           instead (same as \`norbix configure\`). Use it for scripts and CI,
           or set NORBIX_HOST + NORBIX_API_KEY + NORBIX_PROJECT_ID.

A shell with no terminal (scripts, CI, agents) without --api-key,
--no-browser or --wait exits 2.`

  static examples = [
    '<%= config.bin %> login',
    '<%= config.bin %> login --host cloud.example.com',
    '<%= config.bin %> login --profile finlo',
    '<%= config.bin %> login --project 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> login --no-browser --json',
    '<%= config.bin %> login --wait --json',
    '<%= config.bin %> login --api-key nbsu_7hK2abc --project 66b2f0a1c3d4e5f6a7b8c9d0 --region nb-eu-germany --profile ci',
    '<%= config.bin %> login --api-key nbsu_7hK2abc --project 66b2f0a1c3d4e5f6a7b8c9d0 --host hub.example.com --profile example-ci',
    '<%= config.bin %> login --host localhost:5001',
  ]

  static flags = {
    'no-browser': Flags.boolean({
      description:
        'Never open a browser: print the link. Works without a terminal. With --json: start the sign-in, print the link and exit (finish it with --wait)',
      default: false,
    }),
    wait: Flags.boolean({
      description: 'Finish a sign-in started with --no-browser --json: wait up to 90 s; run again until it is approved',
      default: false,
      exclusive: ['no-browser', 'api-key'],
    }),
  }

  /** Saving an API key needs no network; the browser modes discover the host in `run`. */
  static discoversHost = false

  async run(): Promise<unknown> {
    const {flags} = await this.parse(Login)
    const noBrowser = flags['no-browser']

    // Mode 1: API key → saved as a profile (long-lived identity).
    if (flags['api-key']) return this.saveApiKey(flags)

    // No terminal to answer a prompt: only the flag-driven modes can work.
    if (!flags.wait && !this.isInteractive() && !noBrowser) {
      throw usageError(
        'login needs a terminal to open the browser, and this shell is not interactive.',
        'Coding agents: `norbix login --no-browser --json`, show the link to the person, then `norbix login --wait` until it is approved. ' +
          'Scripts and CI: --api-key <key> --project <id> (saves a profile), or NORBIX_HOST + NORBIX_API_KEY + NORBIX_PROJECT_ID in the environment.',
        'norbix login --help',
      )
    }

    await this.prepareHost(flags)
    const ctx = this.resolveContext(flags)

    // Mode 3: the second step of the agent sign-in.
    if (flags.wait) return this.pickProject(flags, await this.finishPending(ctx, flags))

    if (ctx.hostInfo?.source !== 'discovered') this.assertEndpoints(ctx)

    // Mode 2 (default): browser sign-in via the device flow.
    try {
      return await this.pickProject(flags, await this.browserLogin(ctx, flags))
    } catch (error) {
      if (!(error instanceof DeviceFlowUnsupportedError)) throw error
      throw usageError(
        'This Hub is older than the browser sign-in.',
        'Sign in with a service-user API key instead: norbix login --api-key <key> --project <id>.',
        'norbix login --help',
      )
    }
  }

  /**
   * A sign-in without a project: the account's only project is saved into
   * the session; with several, they are listed with how to choose one.
   */
  private async pickProject(flags: GlobalFlags, result: unknown): Promise<unknown> {
    const signedIn = result as {status?: string; projectId?: string}
    if (signedIn?.status !== 'signed-in' || signedIn.projectId) return result
    const adoption = await this.adoptOnlyProject(flags)
    if (adoption.state === 'saved') {
      const inRegion = adoption.region ? ` (region ${adoption.region})` : ''
      this.print(`Project: ${projectLabel(adoption.projects[0])}${inRegion} — the only project of this account, saved to the sign-in.`)
      return {
        ...signedIn,
        projectId: adoption.projectId,
        ...(adoption.region ? {region: adoption.region} : {}),
        projectSource: 'only project of the account',
      }
    }

    if (adoption.state === 'several') {
      this.print(
        `This account has ${adoption.projects.length} projects and none is chosen yet. Pick one: ` +
          `norbix config set project_id <id>${flags.profile ? ` --profile ${flags.profile}` : ''}, or pass --project <id> / set NORBIX_PROJECT_ID.\n` +
          projectLines(adoption.projects),
      )
      return {...signedIn, projects: adoption.projects}
    }

    if (adoption.state === 'none') this.print('This account has no projects yet: create one in the dashboard.')
    return result
  }

  private async saveApiKey(flags: {
    'api-key'?: string
    host?: string
    profile?: string
    project?: string
    region?: string
  }): Promise<unknown> {
    const profName = flags.profile ?? 'default'
    const existing = readProfiles()[profName] ?? {}
    const projectId = flags.project ?? existing.project_id ?? (await this.ask('Project ID:'))
    const host = flags.host ? storedHost(flags.host) : existing.host
    writeProfile(profName, {
      ...existing,
      host,
      api_key: flags['api-key'],
      project_id: projectId,
      region: flags.region ?? existing.region,
      // A host replaces the deprecated full URLs.
      ...(host ? {api_url: undefined, hub_url: undefined} : {}),
    })
    this.print(
      `API key saved to profile [${profName}]${host ? ` for ${host}` : ''}. Try \`norbix whoami${profName === 'default' ? '' : ` --profile ${profName}`}\` to verify.`,
    )
    return {method: 'apiKey', profile: profName, host: host ?? 'hub.norbix.ai', projectId}
  }

  /** Prompt for a value — or, with no terminal, fail with the flag to pass instead. */
  private async ask(message: string): Promise<string> {
    if (!this.isInteractive()) {
      throw usageError(
        `login needs "${message.replace(/:$/, '')}" and cannot prompt for it in a non-interactive shell.`,
        'Pass --project on the command line.',
        'norbix login --help',
      )
    }

    const {input} = await import('@inquirer/prompts')
    return input({message, required: true})
  }

  private async browserLogin(
    ctx: ResolvedContext,
    flags: {account?: string; env?: string; region?: string; project?: string; 'no-browser': boolean},
  ): Promise<unknown> {
    const hub = await this.hubEndpoint(ctx)
    // Only what was asked for — never the project of an older sign-in.
    const projectId = ctx.requestedProjectId
    const host = new URL(ctx.host).host
    const agentStep = flags['no-browser'] && this.jsonEnabled()
    if (!agentStep) this.log(describeTarget(ctx, flags))
    const start = await startDeviceFlow(hub, {deviceName: deviceName(), projectId})
    const link = start.verificationUriComplete ?? start.verificationUri
    const expiresIn = start.expiresIn ?? 600

    // Agent step 1: save the code, print the link, exit at once.
    if (agentStep) {
      const now = Date.now()
      writePending(sessionKey(ctx.hubKey, projectId), {
        deviceCode: start.deviceCode,
        userCode: start.userCode,
        verificationUri: start.verificationUri,
        verificationUriComplete: start.verificationUriComplete,
        expiresAt: new Date(now + expiresIn * 1000).toISOString(),
        interval: start.interval ?? 5,
        host,
        hubUrl: hub.base,
        hubVersion: hub.version,
        apiUrl: ctx.hostInfo?.apiUrl,
        projectId,
        accountId: ctx.accountId,
        env: flags.env,
        region: flags.region ?? ctx.region,
        startedAt: new Date(now).toISOString(),
      })
      return {
        status: 'pending',
        host,
        userCode: start.userCode,
        verificationUri: start.verificationUri,
        verificationUriComplete: start.verificationUriComplete ?? start.verificationUri,
        expiresIn,
        next: `norbix login --wait${hostArgs(ctx, flags)}`,
      }
    }

    const minutes = Math.round(expiresIn / 60)
    this.log('')
    this.log(`  Your one-time code:  ${start.userCode}`)
    this.log('')
    this.log(`Approve this sign-in on the Norbix dashboard: ${link}`)
    this.log('Check that the dashboard shows the same code, then pick the roles the CLI gets.')
    if (flags['no-browser'] || !canOpenBrowser()) {
      this.log('No browser is opened here: open the link on any device.')
    } else if (this.isInteractive()) {
      const {input} = await import('@inquirer/prompts')
      await input({message: 'Press ENTER to open the browser...'})
      openBrowser(link)
    }

    this.log(`Waiting for you to approve in the browser (the code expires in ${minutes} minutes)...`)

    const token = await pollDeviceToken(hub, start, (m) => this.log(m))
    return this.saveSignIn(ctx, hub, token, {
      host,
      projectId,
      accountId: flags.account ?? ctx.accountId,
      env: flags.env,
      region: flags.region ?? ctx.region,
      apiUrl: ctx.hostInfo?.apiUrl,
    })
  }

  /** Agent step 2: poll the saved code for up to 90 s. */
  private async finishPending(ctx: ResolvedContext, flags: {project?: string}): Promise<unknown> {
    const host = new URL(ctx.host).host
    const {key, pending} = this.pendingFor(ctx)
    if (!pending) {
      const forProject = ctx.requestedProjectId ? ` for project ${ctx.requestedProjectId}` : ''
      throw usageError(
        `No browser sign-in is waiting for ${host}${forProject}.`,
        `Start one with \`norbix login --no-browser --json${hostArgs(ctx, flags)}\`, show the link to the person, then run \`norbix login --wait${hostArgs(ctx, flags)}\`.`,
        'norbix login --help',
      )
    }

    const now = Date.now()
    const left = Math.floor((Date.parse(pending.expiresAt) - now) / 1000)
    if (!(left > 0)) {
      clearPending(key)
      throw expiredError()
    }

    const hub: HubEndpoint = {base: pending.hubUrl, version: pending.hubVersion}
    let token: DeviceTokenSuccess | undefined
    try {
      token = await pollDeviceTokenUntil(
        hub,
        {
          deviceCode: pending.deviceCode,
          userCode: pending.userCode,
          verificationUri: pending.verificationUri,
          expiresIn: left,
          interval: pending.interval,
        },
        (m) => this.log(m),
        {
          until: now + WAIT_SLICE_MS,
          onSlowDown: (interval) => writePending(key, {...pending, interval}),
        },
      )
    } catch (error) {
      // Denied, expired, refused: this code can never succeed.
      if (error instanceof CliError && error.exit === EXIT.AUTH) clearPending(key)
      throw error
    }

    if (!token) throw notApprovedYet(pending, ctx, flags)
    clearPending(key)
    return this.saveSignIn(ctx, hub, token, pending)
  }

  /**
   * The code waiting for this Hub and the requested project. With no project
   * requested, the Hub's only waiting code is taken, whatever its project.
   */
  private pendingFor(ctx: ResolvedContext): {key: string; pending?: PendingSignIn} {
    const key = sessionKey(ctx.hubKey, ctx.requestedProjectId)
    const own = readPending(key)
    if (own || ctx.requestedProjectId) return {key, pending: own}
    const waiting = listPendingKeys().filter((k) => parseSessionKey(k).hubKey === ctx.hubKey)
    return waiting.length === 1 ? {key: waiting[0], pending: readPending(waiting[0])} : {key}
  }

  /**
   * A sign-in made with --host / NORBIX_HOST is used by later commands only
   * when they name that host too. With no [default] profile yet, the host is
   * saved as [default], so plain `norbix …` uses the sign-in. An existing
   * [default] for another host is never changed: the note says how to switch.
   */
  private rememberHost(ctx: ResolvedContext): {state: 'created' | 'same host' | 'other host' | 'not needed'; note?: string} {
    if (ctx.hostSource !== 'flag/env') return {state: 'not needed'}
    const host = storedHost(ctx.host)
    const current = readProfiles().default
    if (!current) {
      writeProfile('default', {host})
      return {state: 'created', note: `Saved host = ${host} in profile [default]: later commands use this sign-in.`}
    }

    const origin = current.host
      ? normalizeHost(current.host)
      : current.hub_url
        ? new URL(current.hub_url).origin
        : normalizeHost(DEFAULT_HOST)
    const hub = cachedHost(origin)?.hubKey ?? hostKey(origin)
    if (hub === ctx.hubKey) return {state: 'same host'}
    const shown = storedHost(origin)
    return {
      state: 'other host',
      note:
        `Commands without --host still use profile [default] (${shown}). ` +
        `Use this sign-in with --host ${host} or NORBIX_HOST=${host}, or make it the default: norbix config set host ${host}`,
    }
  }

  private saveSignIn(
    ctx: ResolvedContext,
    hub: HubEndpoint,
    token: DeviceTokenSuccess,
    meta: Pick<PendingSignIn, 'host' | 'projectId' | 'accountId' | 'env' | 'region' | 'apiUrl'>,
  ): unknown {
    const now = Date.now()
    // Saved under the project the Hub pinned the token to (the one asked for,
    // or the one the chosen roles imply); a sign-in for another project stays.
    const projectId = token.projectId ?? meta.projectId
    const key = sessionKey(ctx.hubKey, projectId)
    writeSession(key, {
      bearerToken: token.bearerToken,
      refreshToken: token.refreshToken,
      expiresAt: typeof token.expiresIn === 'number' ? new Date(now + token.expiresIn * 1000).toISOString() : undefined,
      clientId: token.clientId,
      method: 'browser',
      hubVersion: hub.version,
      hubUrl: hub.base,
      apiUrl: meta.apiUrl,
      host: meta.host,
      projectId,
      accountId: token.accountId ?? meta.accountId,
      env: meta.env,
      region: meta.region,
      userId: token.userId,
      userName: token.userName,
      displayName: token.displayName,
      savedAt: new Date(now).toISOString(),
    })

    const defaultProfile = this.rememberHost(ctx)
    const who = token.displayName ?? token.userName ?? 'an AI service user'
    this.print(
      [
        `Signed in to ${meta.host} as ${who}${token.userName && token.displayName && token.userName !== token.displayName ? ` (${token.userName})` : ''} — an AI service user with the roles you picked.`,
        'Remove it any time in the dashboard: Account → AI service users.',
        `Session saved to ${sessionPath(key)}${projectId ? ` (project ${projectId})` : ' (no project)'}.`,
        ...(defaultProfile.note ? [defaultProfile.note] : []),
      ].join('\n'),
    )
    return {
      status: 'signed-in',
      method: 'browser',
      host: meta.host,
      hub: ctx.hubKey,
      defaultProfile: defaultProfile.state,
      userId: token.userId,
      userName: token.userName,
      displayName: token.displayName,
      accountId: token.accountId ?? meta.accountId,
      projectId,
    }
  }
}

/** One line, before anything is sent: which host, profile and project the sign-in is for. */
function describeTarget(ctx: ResolvedContext, flags: {project?: string}): string {
  const host = new URL(ctx.host).host
  const profile = ctx.profileName ? `profile [${ctx.profileName}]` : 'no profile'
  const project = ctx.requestedProjectId
  const source = flags.project ? '--project / NORBIX_PROJECT_ID' : `project_id of ${profile}`
  return project
    ? `Signing in to ${host} (${profile}) for project ${project} (from ${source}).`
    : `Signing in to ${host} (${profile}) with no project named — pass --project <id> to sign in for one; with one project in the account it is picked by itself.`
}

/** ` --host x` / ` --profile p` / ` --project id` so a printed next step reaches the same Hub and project. */
function hostArgs(ctx: ResolvedContext, flags: {project?: string}): string {
  let args = ''
  if (ctx.hostSource === 'flag/env') args += ` --host ${storedHost(ctx.host)}`
  else if (ctx.profileName && ctx.profileName !== 'default') args += ` --profile ${ctx.profileName}`
  if (flags.project) args += ` --project ${flags.project}`
  return args
}

function notApprovedYet(pending: PendingSignIn, ctx: ResolvedContext, flags: {project?: string}): CliError {
  const link = pending.verificationUriComplete ?? pending.verificationUri
  return new CliError({
    exit: EXIT.AUTH,
    code: 'AUTHORIZATION_PENDING',
    message: `Not approved yet. The person must open ${link} and check the code ${pending.userCode}.`,
    hint: `Run \`norbix login --wait${hostArgs(ctx, flags)}\` again. The code expires at ${pending.expiresAt}.`,
    docs: 'norbix login --help',
  })
}
