import {BaseCommand} from '../base.js'
import {PROFILES_PATH, SESSION_PATH} from '../lib/profiles.js'
import {redact} from '../lib/store.js'

export default class Whoami extends BaseCommand {
  static description = 'Show the resolved context (profile, auth source, endpoints) and verify it against the server'

  static examples = [
    '<%= config.bin %> whoami',
    '<%= config.bin %> whoami --profile fitskin-prod',
    '<%= config.bin %> whoami --json',
  ]

  async run(): Promise<unknown> {
    const {flags} = await this.parse(Whoami)
    const ctx = this.resolveContext(flags)

    const summary = {
      profile: ctx.profileName ?? '(none)',
      auth: ctx.authSource === 'session' ? `session (${ctx.userName ?? 'user'})` : ctx.authSource,
      apiKey: ctx.apiKey ? redact(ctx.apiKey) : undefined,
      projectId: ctx.projectId,
      accountId: ctx.accountId,
      env: ctx.env ?? 'PROD',
      region:
        ctx.region ??
        (ctx.usesDefaultEndpoints
          ? '(NOT SET — required with default endpoints!)'
          : '(not set — optional with custom endpoints)'),
      apiUrl: ctx.apiUrl,
      hubUrl: ctx.hubUrl,
      profilesFile: PROFILES_PATH,
      sessionFile: SESSION_PATH,
    }

    let verified = false
    let environments: string[] | undefined
    let verifyError: string | undefined

    if (ctx.projectId && (ctx.apiKey || ctx.bearerToken)) {
      try {
        const client = this.client(flags)
        const res = await client.hub.environments.list()
        const item = res.item as {environments?: Array<{name?: string} | string>} | undefined
        environments = (item?.environments ?? []).map((e) =>
          typeof e === 'string' ? e : (e.name ?? String(e)),
        )
        verified = true
      } catch (error) {
        verifyError = error instanceof Error ? error.message : String(error)
      }
    }

    this.print(
      [
        `Profile:  ${summary.profile}`,
        `Auth:     ${summary.auth}${summary.apiKey ? ` (${summary.apiKey})` : ''}`,
        `Project:  ${summary.projectId ?? '(not set)'}`,
        `Account:  ${summary.accountId ?? '(not set)'}`,
        `Env:      ${summary.env}`,
        `Region:   ${summary.region}`,
        `API:      ${summary.apiUrl}`,
        `Hub:      ${summary.hubUrl}`,
        verified
          ? `Server:   OK${environments?.length ? ` — environments: ${environments.join(', ')}` : ''}`
          : `Server:   not verified${verifyError ? ` (${verifyError})` : ''}`,
      ].join('\n'),
    )

    return {...summary, verified, environments, verifyError}
  }
}
