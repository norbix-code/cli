import {Norbix} from '@norbix.ai/ts'
import {Flags} from '@oclif/core'

import {BaseCommand, type ResolvedContext} from '../base.js'
import {usageError} from '../lib/cli-error.js'
import {
  DeviceFlowUnsupportedError,
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

The session is saved to ~/.norbix/session.json and every terminal window
uses it. The access token lasts one hour and is refreshed by itself; when
the sign-in is removed or runs out, the next command asks you to log in
again (exit 4).

If the Hub is older than the browser sign-in, the CLI says so and falls
back to user + password.

--user / --password  force the password flow.
--api-key            saves a long-lived key into a profile instead
                     (same as \`norbix configure\`).

Commands run with --profile skip the session on purpose and use that
profile's API key.

Non-interactive shells (scripts, CI, coding agents) cannot answer prompts:
pass --api-key (with --project), or --user with --password, or set
NORBIX_API_KEY in the environment. Without one of these the command exits 2.`

  static examples = [
    '<%= config.bin %> login',
    '<%= config.bin %> login --user alice@example.com',
    '<%= config.bin %> login --api-key nbk_live_7hK2abc --project 66b2f0a1c3d4e5f6a7b8c9d0 --region nb-eu-germany --profile ci',
    '<%= config.bin %> login --user alice@example.com --password "$NORBIX_PASSWORD" --project 66b2f0a1c3d4e5f6a7b8c9d0',
  ]

  static flags = {
    user: Flags.string({char: 'u', description: 'User name (email) — forces password login'}),
    password: Flags.string({char: 'p', description: 'Password (prompted securely if omitted)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(Login)
    const profiles = readProfiles()
    const profName = flags.profile ?? 'default'
    const existing = profiles[profName] ?? {}

    // No terminal to answer a prompt: only the flag-driven modes can work.
    if (!this.isInteractive() && !flags['api-key'] && !flags.password) {
      throw usageError(
        'login needs a terminal to ask for credentials, and this shell is not interactive.',
        'Non-interactive options: --api-key <key> --project <id> (saves a profile); ' +
          '--user <email> --password <pw> (password login); or set NORBIX_API_KEY and NORBIX_PROJECT_ID in the environment and skip login.',
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
      })
      this.print(
        `API key saved to profile [${profName}]. Try \`norbix whoami${profName === 'default' ? '' : ` --profile ${profName}`}\` to verify.`,
      )
      return {method: 'apiKey', profile: profName, projectId}
    }

    const ctx = this.resolveContext(flags)
    this.assertEndpoints(ctx)

    // Mode 2 (default): browser sign-in via the device flow.
    if (!flags.user && !flags.password) {
      try {
        return await this.browserLogin(ctx, flags.project ?? existing.project_id, flags)
      } catch (error) {
        if (!(error instanceof DeviceFlowUnsupportedError)) throw error
        this.log('Note: this Hub is older than the browser sign-in, so the CLI signs in with user + password.\n')
      }
    }

    // Mode 3: user + password.
    return this.passwordLogin(flags, existing)
  }

  /** Prompt for a value — or, with no terminal, fail with the flag to pass instead. */
  private async ask(message: string, secret = false): Promise<string> {
    if (!this.isInteractive()) {
      const flag = message.startsWith('Project') ? '--project' : message.startsWith('User') ? '--user' : '--password'
      throw usageError(
        `login needs "${message.replace(/:$/, '')}" and cannot prompt for it in a non-interactive shell.`,
        `Pass ${flag} on the command line.`,
        'norbix login --help',
      )
    }

    const prompts = await import('@inquirer/prompts')
    return secret ? prompts.password({message, mask: '*'}) : prompts.input({message, required: true})
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
    if (this.isInteractive()) {
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

  private async passwordLogin(
    flags: {
      user?: string
      password?: string
      project?: string
      account?: string
      env?: string
      region?: string
      profile?: string
    },
    existing: {project_id?: string; account_id?: string; env?: string; region?: string},
  ): Promise<unknown> {
    const projectId = flags.project ?? existing.project_id ?? (await this.ask('Project ID:'))
    const region = flags.region ?? existing.region
    const userName = flags.user ?? (await this.ask('User name (email):'))
    const pwd = flags.password ?? (await this.ask('Password:', true))

    const ctx = this.resolveContext({...flags, project: projectId, region})
    const client = new Norbix(
      {projectId, region, env: flags.env ?? existing.env, baseUrl: {api: ctx.apiUrl, hub: ctx.hubUrl}},
      {envSource: {}},
    )
    const res = await client.login({userName, password: pwd})
    if (!res.bearerToken) this.error('Login succeeded but no token was returned.')

    writeSession({
      bearerToken: res.bearerToken,
      refreshToken: res.refreshToken,
      method: 'password',
      projectId,
      accountId: flags.account ?? existing.account_id,
      env: flags.env ?? existing.env,
      region,
      userId: res.userId,
      userName: res.userName ?? userName,
      displayName: res.displayName,
      savedAt: new Date().toISOString(),
    })

    this.print(
      `Logged in as ${res.displayName ?? res.userName ?? userName} (project ${projectId}).\nSession saved to ${SESSION_PATH}.`,
    )
    return {method: 'credentials', projectId, userId: res.userId, userName: res.userName ?? userName}
  }
}
