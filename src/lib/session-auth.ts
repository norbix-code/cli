import {CliError} from './cli-error.js'
import {EXIT, exitForStatus} from './exit-codes.js'
import {hubRoute, type HubEndpoint} from './hub-version.js'
import {
  clearSession,
  isSessionRefreshable,
  readSession,
  sessionExpiryMs,
  writeSession,
  type Session,
} from './profiles.js'

/**
 * Keeps a browser sign-in alive: the access token lives one hour, the
 * refresh token 30 days and rotates on every use.
 *
 *   POST {hub}/{v}/oauth/token    (form)
 *     grant_type=refresh_token & refresh_token & client_id
 *     → { access_token, expires_in, refresh_token, token_type, scope }
 *     → 400 { error: "invalid_grant" | ... }   the sign-in is gone
 *
 *   POST {hub}/{v}/oauth/revoke   (form, RFC 7009)
 *     token & token_type_hint=refresh_token & client_id   → 200 {}
 *
 * Tokens are never logged or printed.
 *
 * No oclif import.
 */

/** OAuth errors that mean the refresh token will never work again. */
const GRANT_GONE = new Set(['invalid_grant', 'invalid_client', 'unauthorized_client'])

/** Refresh when the access token has less than this left. */
export const REFRESH_SKEW_MS = 60_000

export interface RefreshDeps {
  fetch?: typeof fetch
  now?: () => number
  /** The Hub whose session file is read and written (~/.norbix/sessions/<hubKey>.json). */
  hubKey?: string
  /** Read / write the stored session — the Hub's file in ~/.norbix/sessions by default. */
  read?: () => Session | undefined
  write?: (session: Session) => void
  clear?: () => void
}

/** True when the token expires within REFRESH_SKEW_MS and the session can refresh it. */
export function needsRefresh(session: Session, now = Date.now()): boolean {
  if (!isSessionRefreshable(session)) return false
  const exp = sessionExpiryMs(session)
  return exp !== undefined && exp - now < REFRESH_SKEW_MS
}

/** The sign-in cannot be refreshed any more: the tokens are cleared, exit 4. */
export function sessionExpiredError(reason?: string): CliError {
  return new CliError({
    exit: EXIT.AUTH,
    code: 'SESSION_EXPIRED',
    message: `Your sign-in has ended${reason ? ` (${reason})` : ''}. The stored tokens were removed.`,
    hint: 'Run `norbix login` to sign in again.',
    docs: 'norbix login --help',
  })
}

/**
 * Exchanges the refresh token for a new access token and stores both at once.
 * One instance per command run: concurrent callers share one request, and a
 * forced refresh (after a 401) happens at most once.
 */
export class SessionRefresher {
  private inFlight?: Promise<Session>
  private forced = false
  /** A refresh that ended the sign-in: every later call fails the same way, with no new request. */
  private ended?: CliError
  private readonly fetchFn: typeof fetch
  private readonly now: () => number
  private readonly read: () => Session | undefined
  private readonly write: (session: Session) => void
  private readonly clear: () => void

  constructor(
    private session: Session,
    private readonly hub: () => Promise<HubEndpoint>,
    deps: RefreshDeps = {},
  ) {
    this.fetchFn = deps.fetch ?? fetch
    this.now = deps.now ?? Date.now
    const key = deps.hubKey
    const none = () => undefined
    this.read = deps.read ?? (key ? () => readSession(key) : none)
    this.write = deps.write ?? (key ? (s: Session) => writeSession(key, s) : () => {})
    this.clear = deps.clear ?? (key ? () => clearSession(key) : () => {})
  }

  /** The current access token (after any refresh this run made). */
  get token(): string {
    return this.session.bearerToken
  }

  /** Refresh first when the token is about to expire; returns the token to send. */
  async ensureFresh(): Promise<string> {
    if (!needsRefresh(this.session, this.now())) return this.session.bearerToken
    return (await this.refresh()).bearerToken
  }

  /** After a 401: refresh once per run. Undefined when already tried or not possible. */
  async afterUnauthorized(): Promise<string | undefined> {
    if (this.forced || !isSessionRefreshable(this.session)) return undefined
    this.forced = true
    return (await this.refresh()).bearerToken
  }

  private refresh(): Promise<Session> {
    if (this.ended) return Promise.reject(this.ended)
    this.inFlight ??= this.doRefresh().finally(() => {
      this.inFlight = undefined
    })
    return this.inFlight
  }

  private async doRefresh(): Promise<Session> {
    // Another terminal may have refreshed already: the refresh token rotates,
    // so the stored one is the only one that still works.
    const latest = this.read()
    if (latest && latest.refreshToken && latest.refreshToken !== this.session.refreshToken) {
      this.session = latest
      if (!needsRefresh(latest, this.now())) return latest
    }

    const {refreshToken, clientId} = this.session
    if (!refreshToken || !clientId) throw sessionExpiredError()

    const hub = await this.hub()
    const url = hubRoute(hub, 'oauth/token')
    let res: Response
    try {
      res = await this.fetchFn(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'},
        body: new URLSearchParams({grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId}).toString(),
        signal: AbortSignal.timeout(15_000),
      })
    } catch (error) {
      throw new CliError({
        exit: EXIT.NETWORK,
        code: 'NETWORK_ERROR',
        message: `Could not refresh the sign-in: ${error instanceof Error ? error.message : String(error)}`,
        hint: 'Check the network and try again. The sign-in is kept.',
        url,
      })
    }

    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string
      expires_in?: number
      refresh_token?: string
      error?: string
    }

    if (res.ok && body.access_token) {
      const next: Session = {
        ...this.session,
        bearerToken: body.access_token,
        refreshToken: body.refresh_token ?? refreshToken,
        expiresAt:
          typeof body.expires_in === 'number' ? new Date(this.now() + body.expires_in * 1000).toISOString() : undefined,
        savedAt: new Date(this.now()).toISOString(),
      }
      this.write(next)
      this.session = next
      return next
    }

    // The grant is gone (revoked, expired, service user removed). Anything
    // else (a 5xx, a malformed request) keeps the tokens.
    if (GRANT_GONE.has(body.error ?? '')) {
      // Lost a race with another terminal? Use its token instead of clearing.
      const raced = this.read()
      if (raced?.refreshToken && raced.refreshToken !== refreshToken) {
        this.session = raced
        return raced
      }

      this.clear()
      this.ended = sessionExpiredError(body.error)
      throw this.ended
    }

    throw new CliError({
      exit: exitForStatus(res.status),
      message: `Could not refresh the sign-in: HTTP ${res.status}${body.error ? ` (${body.error})` : ''}.`,
      hint: 'Try again in a moment. The sign-in is kept.',
      status: res.status,
      url,
    })
  }
}

export type RevokeOutcome = 'revoked' | 'unsupported' | 'failed' | 'skipped'

/** Revoke the refresh token on the Hub. Never throws — logout goes on regardless. */
export async function revokeSession(
  session: Session,
  hub: HubEndpoint,
  fetchFn: typeof fetch = fetch,
): Promise<RevokeOutcome> {
  if (!session.refreshToken || !session.clientId) return 'skipped'
  try {
    const res = await fetchFn(hubRoute(hub, 'oauth/revoke'), {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'},
      body: new URLSearchParams({
        token: session.refreshToken,
        token_type_hint: 'refresh_token',
        client_id: session.clientId,
      }).toString(),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return 'revoked'
    return [404, 405, 501].includes(res.status) ? 'unsupported' : 'failed'
  } catch {
    return 'failed'
  }
}

/** The request `revokeSession` sends, token hidden — for `logout --dry-run`. */
export function revokeRequest(session: Session, hub: HubEndpoint): {method: string; url: string; body: Record<string, string>} | undefined {
  if (!session.refreshToken || !session.clientId) return undefined
  return {
    method: 'POST',
    url: hubRoute(hub, 'oauth/revoke'),
    body: {token: '***', token_type_hint: 'refresh_token', client_id: session.clientId},
  }
}
