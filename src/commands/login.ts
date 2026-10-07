import {Flags} from '@oclif/core'

import {BaseCommand, type ResolvedContext} from '../base.js'
import {usageError} from '../lib/cli-error.js'
import {
  DeviceFlowUnsupportedError,
  canOpenBrowser,
  deviceName,
  openBrowser,
  pollDeviceToken,
  startDeviceFlow,
} from '../lib/device-login.js'
import {SESSION_PATH, readProfiles, writeProfile, writeSession} from '../lib/profiles.js'

export default class Login extends BaseCommand {
  static description = `Log in to Norbix.

Default: browser sign-in. The CLI shows a one-time code and opens the
Norbix dashboard; you sign in there, pick the roles the CLI gets, and press
Allow. The CLI then works as an AI service user named "Norbix CLI
(<this computer>)" with exactly those roles — never more than you have. You
can remove it any time in the dashboard under Account → AI service users.

On a machine without a desktop (an SSH session, a container) the CLI only
prints the link: open it on any other device, sign in there, and the CLI
picks the sign-in up by itself.

The session is saved to ~/.norbix/session.json and every terminal window
uses it. The access token lasts one hour and is refreshed by itself; when
the sign-in is removed or runs out, the next command asks you to log in
again (exit 4).

--api-key  saves a long-lived service-user key into a profile instead
           (same as \`norbix configure\`). Use it for scripts and CI.
           --api-url / --hub-url (or NORBIX_API_URL / NORBIX_HUB_URL)
           are saved with it for a self-hosted install.

Commands run with --profile skip the session on purpose and use that
profile's API key.

Non-interactive shells (scripts, CI, coding agents) cannot answer prompts:
pass --api-key (with --project), or set NORBIX_API_KEY in the environment.
Without one of these the command exits 2.`

  static examples = [
    '<%= config.bin %> login',
    '<%= config.bin %> login --api-key nbsu_7hK2abc --project 66b2f0a1c3d4e5f6a7b8c9d0 --region nb-eu-germany --profile ci',
    '<%= config.bin %> login --api-key nbsu_7hK2abc --project 66b2f0a1c3d4e5f6a7b8c9d0 --api-url http://localhost:5002 --hub-url http://localhost:5001 --profile local',
  ]

  static flags = {
    'api-url': Flags.string({description: 'With --api-key: the API host saved in the profile (self-hosted)'}),
    'hub-url': Flags.string({description: 'With --api-key: the Hub host saved in the profile (self-hosted)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(Login)
    const profiles = readProfiles()
    const profName = flags.profile ?? 'default'
    const existing = profiles[profName] ?? {}

    // No terminal to answer a prompt: only the flag-driven modes can work.
    if (!this.isInteractive() && !flags['api-key']) {
      throw usageError(
        'login needs a terminal to ask for credentials, and this shell is not interactive.',
        'Non-interactive options: --api-key <key> --project <id> (saves a profile); ' +
          'or set NORBIX_API_KEY and NORBIX_PROJECT_ID in the environment and skip login.',
        'norbix login --help',
      )
    }

    // Mode 1: API key → saved as a profile (long-lived identity).
    if (flags['api-key']) {
      const projectId = flags.project ?? existing.project_id ?? (await this.ask('Project ID:'))
      writeProfile(profName, {
        ...existing,
        api_key: flags['api-key'],
        project_id: projectId,
        region: flags.region ?? existing.region,
        api_url: flags['api-url'] ?? envUrl('NORBIX_API_URL') ?? existing.api_url,
        hub_url: flags['hub-url'] ?? envUrl('NORBIX_HUB_URL') ?? existing.hub_url,
      })
      this.print(
        `API key saved to profile [${profName}]. Try \`norbix whoami${profName === 'default' ? '' : ` --profile ${profName}`}\` to verify.`,
      )
      return {method: 'apiKey', profile: profName, projectId}
    }

    if (flags['api-url'] || flags['hub-url']) {
      throw usageError(
        '--api-url and --hub-url are saved with --api-key only.',
        'For a browser sign-in against a self-hosted install, set NORBIX_API_URL and NORBIX_HUB_URL.',
        'norbix login --help',
      )
    }

    const ctx = this.resolveContext(flags)
    this.assertEndpoints(ctx)

    // Mode 2 (default): browser sign-in via the device flow.
    try {
      return await this.browserLogin(ctx, flags.project ?? existing.project_id, flags)
    } catch (error) {
      if (!(error instanceof DeviceFlowUnsupportedError)) throw error
      throw usageError(
        'This Hub is older than the browser sign-in.',
        'Sign in with a service-user API key instead: norbix login --api-key <key> --project <id>.',
        'norbix login --help',
      )
    }
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
    projectId: string | undefined,
    flags: {account?: string; env?: string; region?: string},
  ): Promise<unknown> {
    const hub = await this.hubEndpoint(ctx)
    const start = await startDeviceFlow(hub, {deviceName: deviceName(), projectId})
    const link = start.verificationUriComplete ?? start.verificationUri
    const minutes = Math.round((start.expiresIn ?? 600) / 60)

    this.log('')
    this.log(`  Your one-time code:  ${start.userCode}`)
    this.log('')
    this.log(`Approve this sign-in on the Norbix dashboard: ${link}`)
    this.log('Check that the dashboard shows the same code, then pick the roles the CLI gets.')
    if (!canOpenBrowser()) {
      this.log('No desktop here to open a browser: open the link on any other device.')
    } else if (this.isInteractive()) {
      const {input} = await import('@inquirer/prompts')
      await input({message: 'Press ENTER to open the browser...'})
      openBrowser(link)
    }

    this.log(`Waiting for you to approve in the browser (the code expires in ${minutes} minutes)...`)

    const token = await pollDeviceToken(hub, start, (m) => this.log(m))
    const now = Date.now()

    writeSession({
      bearerToken: token.bearerToken,
      refreshToken: token.refreshToken,
      expiresAt: typeof token.expiresIn === 'number' ? new Date(now + token.expiresIn * 1000).toISOString() : undefined,
      clientId: token.clientId,
      method: 'browser',
      hubVersion: hub.version,
      hubUrl: ctx.customEndpoints.hub,
      apiUrl: ctx.customEndpoints.api,
      projectId: token.projectId ?? projectId,
      accountId: token.accountId ?? flags.account,
      env: flags.env,
      region: flags.region ?? ctx.region,
      userId: token.userId,
      userName: token.userName,
      displayName: token.displayName,
      savedAt: new Date(now).toISOString(),
    })

    const who = token.displayName ?? token.userName ?? 'an AI service user'
    this.print(
      [
        `Signed in as ${who}${token.userName && token.displayName && token.userName !== token.displayName ? ` (${token.userName})` : ''} — an AI service user with the roles you picked.`,
        'Remove it any time in the dashboard: Account → AI service users.',
        `Session saved to ${SESSION_PATH}.`,
      ].join('\n'),
    )
    return {
      method: 'browser',
      userId: token.userId,
      userName: token.userName,
      displayName: token.displayName,
      accountId: token.accountId ?? flags.account,
      projectId: token.projectId ?? projectId,
    }
  }
}

/** A host from the environment, or undefined when unset or blank. */
function envUrl(name: string): string | undefined {
  return process.env[name]?.trim() || undefined
}
