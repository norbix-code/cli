import {input, password as passwordPrompt} from '@inquirer/prompts'
import {Norbix} from '@norbix.ai/ts'
import {Flags} from '@oclif/core'

import {BaseCommand} from '../base.js'
import {
  DeviceFlowUnsupportedError,
  openBrowser,
  pollDeviceToken,
  startDeviceFlow,
} from '../lib/device-login.js'
import {SESSION_PATH, readProfiles, writeProfile, writeSession} from '../lib/profiles.js'

export default class Login extends BaseCommand {
  static description = `Log in to Norbix.

Default: browser login — the CLI shows a code, opens hub in your browser,
you approve there, and a session is saved to ~/.norbix/session.json. New
terminal windows reuse the session while it is valid. If the hub does not
support browser login yet, the CLI falls back to user + password.

--user / --password  force the password flow.
--api-key            saves a long-lived key into a profile instead
                     (same as \`norbix configure\`).

Commands run with --profile skip the session on purpose and use that
profile's API key.`

  static examples = [
    '<%= config.bin %> login',
    '<%= config.bin %> login --user alice@example.com',
    '<%= config.bin %> login --api-key nbk_... --project 5f1a... --profile ci',
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

    // Mode 1: API key → saved as a profile (long-lived identity).
    if (flags['api-key']) {
      const projectId =
        flags.project ?? existing.project_id ?? (await input({message: 'Project ID:', required: true}))
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

    // Mode 2 (default): browser login via the device flow.
    if (!flags.user && !flags.password) {
      try {
        return await this.browserLogin(ctx.hubUrl, flags.project ?? existing.project_id, flags)
      } catch (error) {
        if (!(error instanceof DeviceFlowUnsupportedError)) throw error
        this.log('Browser login is not available on this hub yet — falling back to password login.\n')
      }
    }

    // Mode 3: user + password.
    return this.passwordLogin(flags, existing)
  }

  private async browserLogin(
    hubUrl: string,
    projectId: string | undefined,
    flags: {account?: string; env?: string; region?: string},
  ): Promise<unknown> {
    const start = await startDeviceFlow(hubUrl, projectId)

    this.log(`First, copy your one-time code: ${start.userCode}`)
    if (process.stdout.isTTY) {
      await input({message: 'Press ENTER to open the browser...'})
      openBrowser(start.verificationUriComplete ?? start.verificationUri)
    }

    this.log(`Or open this URL yourself: ${start.verificationUri}`)
    this.log('Waiting for you to approve in the browser...')

    const token = await pollDeviceToken(hubUrl, start, (m) => this.log(m))

    writeSession({
      bearerToken: token.bearerToken,
      refreshToken: token.refreshToken,
      projectId: token.projectId ?? projectId,
      accountId: token.accountId ?? flags.account,
      env: flags.env,
      region: flags.region,
      userId: token.userId,
      userName: token.userName,
      savedAt: new Date().toISOString(),
    })

    this.print(
      `Logged in as ${token.displayName ?? token.userName ?? 'user'}.\nSession saved to ${SESSION_PATH}.`,
    )
    return {method: 'browser', userId: token.userId, userName: token.userName}
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
    const projectId =
      flags.project ?? existing.project_id ?? (await input({message: 'Project ID:', required: true}))
    const region = flags.region ?? existing.region
    const userName = flags.user ?? (await input({message: 'User name (email):', required: true}))
    const pwd = flags.password ?? (await passwordPrompt({message: 'Password:', mask: '*'}))

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
      projectId,
      accountId: flags.account ?? existing.account_id,
      env: flags.env ?? existing.env,
      region,
      userId: res.userId,
      userName: res.userName ?? userName,
      savedAt: new Date().toISOString(),
    })

    this.print(
      `Logged in as ${res.displayName ?? res.userName ?? userName} (project ${projectId}).\nSession saved to ${SESSION_PATH}.`,
    )
    return {method: 'credentials', projectId, userId: res.userId, userName: res.userName ?? userName}
  }
}
