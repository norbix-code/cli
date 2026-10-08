import {Flags} from '@oclif/core'

import {BaseCommand, type ResolvedContext} from '../base.js'
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
import {storedHost} from '../lib/hosts.js'
import {type HubEndpoint} from '../lib/hub-version.js'
import {
  clearPending,
  readPending,
  readProfiles,
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
The Hub tells the CLI every other address. One sign-in per Hub: it is saved
to ~/.norbix/sessions/<hub>.json, every terminal window and every profile of
that host without an API key uses it. The access token lasts one hour and
is refreshed by itself; when the sign-in is removed or runs out, the next
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
    if (flags.wait) return this.finishPending(ctx)

    if (ctx.hostInfo?.source !== 'discovered') this.assertEndpoints(ctx)

    // Mode 2 (default): browser sign-in via the device flow.
    try {
      return await this.browserLogin(ctx, flags)
    } catch (error) {
      if (!(error instanceof DeviceFlowUnsupportedError)) throw error
      throw usageError(
        'This Hub is older than the browser sign-in.',
        'Sign in with a service-user API key instead: norbix login --api-key <key> --project <id>.',
        'norbix login --help',
      )
    }
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
    const projectId = ctx.projectId
    const start = await startDeviceFlow(hub, {deviceName: deviceName(), projectId})
    const link = start.verificationUriComplete ?? start.verificationUri
    const expiresIn = start.expiresIn ?? 600
    const host = new URL(ctx.host).host

    // Agent step 1: save the code, print the link, exit at once.
    if (flags['no-browser'] && this.jsonEnabled()) {
      const now = Date.now()
      writePending(ctx.hubKey, {
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
        next: `norbix login --wait${hostArgs(ctx)}`,
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
  private async finishPending(ctx: ResolvedContext): Promise<unknown> {
    const pending = readPending(ctx.hubKey)
    const host = new URL(ctx.host).host
    if (!pending) {
      throw usageError(
        `No browser sign-in is waiting for ${host}.`,
        `Start one with \`norbix login --no-browser --json${hostArgs(ctx)}\`, show the link to the person, then run \`norbix login --wait\`.`,
        'norbix login --help',
      )
    }

    const now = Date.now()
    const left = Math.floor((Date.parse(pending.expiresAt) - now) / 1000)
    if (!(left > 0)) {
      clearPending(ctx.hubKey)
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
          onSlowDown: (interval) => writePending(ctx.hubKey, {...pending, interval}),
        },
      )
    } catch (error) {
      // Denied, expired, refused: this code can never succeed.
      if (error instanceof CliError && error.exit === EXIT.AUTH) clearPending(ctx.hubKey)
      throw error
    }

    if (!token) throw notApprovedYet(pending, ctx)
    clearPending(ctx.hubKey)
    return this.saveSignIn(ctx, hub, token, pending)
  }

  private saveSignIn(
    ctx: ResolvedContext,
    hub: HubEndpoint,
    token: DeviceTokenSuccess,
    meta: Pick<PendingSignIn, 'host' | 'projectId' | 'accountId' | 'env' | 'region' | 'apiUrl'>,
  ): unknown {
    const now = Date.now()
    writeSession(ctx.hubKey, {
      bearerToken: token.bearerToken,
      refreshToken: token.refreshToken,
      expiresAt: typeof token.expiresIn === 'number' ? new Date(now + token.expiresIn * 1000).toISOString() : undefined,
      clientId: token.clientId,
      method: 'browser',
      hubVersion: hub.version,
      hubUrl: hub.base,
      apiUrl: meta.apiUrl,
      host: meta.host,
      projectId: token.projectId ?? meta.projectId,
      accountId: token.accountId ?? meta.accountId,
      env: meta.env,
      region: meta.region,
      userId: token.userId,
      userName: token.userName,
      displayName: token.displayName,
      savedAt: new Date(now).toISOString(),
    })

    const who = token.displayName ?? token.userName ?? 'an AI service user'
    this.print(
      [
        `Signed in to ${meta.host} as ${who}${token.userName && token.displayName && token.userName !== token.displayName ? ` (${token.userName})` : ''} — an AI service user with the roles you picked.`,
        'Remove it any time in the dashboard: Account → AI service users.',
        `Session saved to ${sessionPath(ctx.hubKey)}.`,
      ].join('\n'),
    )
    return {
      status: 'signed-in',
      method: 'browser',
      host: meta.host,
      hub: ctx.hubKey,
      userId: token.userId,
      userName: token.userName,
      displayName: token.displayName,
      accountId: token.accountId ?? meta.accountId,
      projectId: token.projectId ?? meta.projectId,
    }
  }
}

/** ` --host x` / ` --profile p` so a printed next step reaches the same Hub. */
function hostArgs(ctx: ResolvedContext): string {
  if (ctx.hostSource === 'flag/env') return ` --host ${storedHost(ctx.host)}`
  if (ctx.profileName && ctx.profileName !== 'default') return ` --profile ${ctx.profileName}`
  return ''
}

function notApprovedYet(pending: PendingSignIn, ctx: ResolvedContext): CliError {
  const link = pending.verificationUriComplete ?? pending.verificationUri
  return new CliError({
    exit: EXIT.AUTH,
    code: 'AUTHORIZATION_PENDING',
    message: `Not approved yet. The person must open ${link} and check the code ${pending.userCode}.`,
    hint: `Run \`norbix login --wait${hostArgs(ctx)}\` again. The code expires at ${pending.expiresAt}.`,
    docs: 'norbix login --help',
  })
}
