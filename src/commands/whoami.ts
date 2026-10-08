import {BaseCommand} from '../base.js'
import {CliError} from '../lib/cli-error.js'
import {
  PROFILES_PATH,
  isSessionRefreshable,
  readSession,
  sessionPath,
  sessionExpiryMs,
  type Session,
} from '../lib/profiles.js'
import {redact} from '../lib/store.js'

export default class Whoami extends BaseCommand {
  static description = 'Show the resolved context (host, Hub, Api, profile, auth source, project) and verify it against the server'

  static examples = [
    '<%= config.bin %> whoami',
    '<%= config.bin %> whoami --profile fitskin-prod',
    '<%= config.bin %> whoami --json',
  ]

  async run(): Promise<unknown> {
    const {flags} = await this.parse(Whoami)
    const ctx = this.resolveContext(flags)

    const hubVersioned = `${ctx.hubUrl}${ctx.hubVersion ? `/${ctx.hubVersion}` : ''}`
    const apiVersioned = `${ctx.apiUrl}${ctx.apiVersion ? `/${ctx.apiVersion}` : ''}`
    const summary = {
      host: new URL(ctx.host).host,
      hostSource: ctx.hostSource,
      discovery: ctx.hostInfo?.source ?? (ctx.deprecations.length ? 'deprecated urls' : 'not discovered'),
      hub: hubVersioned,
      api: apiVersioned,
      profile: ctx.profileName ?? '(none)',
      auth: ctx.authSource === 'session' ? `session (${ctx.userName ?? 'user'})` : ctx.authSource,
      apiKey: ctx.apiKey ? redact(ctx.apiKey) : undefined,
      projectId: ctx.projectId,
      accountId: ctx.accountId,
      env: ctx.env ?? 'PROD',
      region:
        ctx.region ??
        (ctx.usesDefaultEndpoints
          ? '(NOT SET — required on norbix.ai, or the project must tell it)'
          : '(not set — optional on this host)'),
      apiUrl: ctx.apiUrl,
      hubUrl: ctx.hubUrl,
      profilesFile: PROFILES_PATH,
      sessionFile: sessionPath(ctx.hubKey),
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
        const raw = (error as {raw?: unknown}).raw
        const cause = raw instanceof CliError ? raw : error
        verifyError = cause instanceof Error ? cause.message : String(cause)
      }
    }

    // Read after the check: it may have refreshed (or ended) the sign-in.
    const signIn = ctx.session ? describeSession(readSession(ctx.hubKey)) : undefined

    this.print(
      [
        `Host:     ${summary.host} (${summary.hostSource})`,
        `Hub:      ${summary.hub}`,
        `API:      ${summary.api}`,
        `Profile:  ${summary.profile}`,
        `Auth:     ${summary.auth}${summary.apiKey ? ` (${summary.apiKey})` : ''}`,
        ...(signIn ? signInLines(signIn) : []),
        `Project:  ${summary.projectId ?? '(not set)'}`,
        `Account:  ${summary.accountId ?? '(not set)'}`,
        `Env:      ${summary.env}`,
        `Region:   ${summary.region}`,
        verified
          ? `Server:   OK${environments?.length ? ` — environments: ${environments.join(', ')}` : ''}`
          : `Server:   not verified${verifyError ? ` (${verifyError})` : ''}`,
      ].join('\n'),
    )

    return {...summary, session: signIn, verified, environments, verifyError}
  }
}

interface SignIn {
  method: 'browser' | 'password'
  userId?: string
  userName?: string
  displayName?: string
  aiServiceUser: boolean
  expiresAt?: string
  refreshes: boolean
}

/** Who the session is — never its tokens. */
function describeSession(session: Session | undefined): SignIn | undefined {
  if (!session) return undefined
  const refreshes = isSessionRefreshable(session)
  const method = session.method ?? (refreshes ? 'browser' : 'password')
  const exp = sessionExpiryMs(session)
  return {
    method,
    userId: session.userId,
    userName: session.userName,
    displayName: session.displayName,
    aiServiceUser: method === 'browser',
    expiresAt: exp === undefined ? undefined : new Date(exp).toISOString(),
    refreshes,
  }
}

function signInLines(s: SignIn): string[] {
  const name = s.displayName ?? s.userName ?? '(unknown)'
  const lines = s.aiServiceUser
    ? [`User:     ${name} — AI service user (remove it in the dashboard: Account → AI service users)`]
    : [`User:     ${name}`]
  if (s.expiresAt) {
    const left = Math.round((Date.parse(s.expiresAt) - Date.now()) / 60_000)
    const when = left > 0 ? `in ${left} min` : 'expired'
    lines.push(`Token:    expires ${s.expiresAt} (${when})${s.refreshes ? ', refreshed by itself' : ''}`)
  }

  return lines
}
