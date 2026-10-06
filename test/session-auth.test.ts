import {describe, expect, it} from 'vitest'

import {CliError} from '../src/lib/cli-error.js'
import {EXIT} from '../src/lib/exit-codes.js'
import type {Session} from '../src/lib/profiles.js'
import {SessionRefresher, needsRefresh, revokeRequest, revokeSession} from '../src/lib/session-auth.js'

/**
 * Keeping a browser sign-in alive: refresh through `/{v}/oauth/token` before
 * the access token expires, or once after a 401; an ended grant clears the
 * tokens. The Hub and the session file are fakes.
 */

const HUB = {base: 'https://hub.test', version: 'v3'}
const NOW = Date.parse('2026-10-06T12:00:00Z')

function session(over: Partial<Session> = {}): Session {
  return {
    bearerToken: 'access-old',
    refreshToken: 'refresh-old',
    clientId: 'norbix-cli',
    method: 'browser',
    hubVersion: 'v3',
    userName: 'norbix-cli-mac',
    expiresAt: new Date(NOW + 30_000).toISOString(), // 30 s left
    ...over,
  }
}

interface Hit {
  url: string
  body: string
}

function tokenEndpoint(answers: Array<{status?: number; body: unknown}>) {
  const hits: Hit[] = []
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    hits.push({url: String(input), body: String(init?.body ?? '')})
    const next = answers.shift() ?? {status: 500, body: {}}
    return new Response(JSON.stringify(next.body), {status: next.status ?? 200})
  }) as typeof fetch
  return {hits, fetchFn}
}

/** An in-memory session file. */
function store(initial?: Session) {
  const box = {current: initial, writes: 0, cleared: false}
  return {
    box,
    deps: {
      read: () => box.current,
      write: (s: Session) => {
        box.current = s
        box.writes++
      },
      clear: () => {
        box.current = undefined
        box.cleared = true
      },
    },
  }
}

const ROTATED = {access_token: 'access-new', token_type: 'Bearer', expires_in: 3600, refresh_token: 'refresh-new', scope: ''}

describe('needsRefresh', () => {
  it('is true within 60 s of the expiry, only for a session that can refresh', () => {
    expect(needsRefresh(session(), NOW)).toBe(true)
    expect(needsRefresh(session({expiresAt: new Date(NOW + 10 * 60_000).toISOString()}), NOW)).toBe(false)
    expect(needsRefresh(session({clientId: undefined}), NOW)).toBe(false) // a password session
  })
})

describe('SessionRefresher', () => {
  it('near expiry: refreshes through {hub}/{version}/oauth/token and stores the rotated token and the new expiry in one write', async () => {
    const s = session()
    const {box, deps} = store(s)
    const {hits, fetchFn} = tokenEndpoint([{body: ROTATED}])
    const refresher = new SessionRefresher(s, async () => HUB, {...deps, fetch: fetchFn, now: () => NOW})

    expect(await refresher.ensureFresh()).toBe('access-new')
    expect(hits).toEqual([
      {url: 'https://hub.test/v3/oauth/token', body: 'grant_type=refresh_token&refresh_token=refresh-old&client_id=norbix-cli'},
    ])
    expect(box.writes).toBe(1)
    expect(box.current).toMatchObject({
      bearerToken: 'access-new',
      refreshToken: 'refresh-new',
      expiresAt: new Date(NOW + 3_600_000).toISOString(),
      clientId: 'norbix-cli',
      userName: 'norbix-cli-mac',
    })

    // Fresh now: no second request.
    expect(await refresher.ensureFresh()).toBe('access-new')
    expect(hits.length).toBe(1)
  })

  it('a token with time left is sent as it is', async () => {
    const s = session({expiresAt: new Date(NOW + 30 * 60_000).toISOString()})
    const {hits, fetchFn} = tokenEndpoint([])
    const refresher = new SessionRefresher(s, async () => HUB, {...store(s).deps, fetch: fetchFn, now: () => NOW})
    expect(await refresher.ensureFresh()).toBe('access-old')
    expect(hits).toEqual([])
  })

  it('after a 401: refreshes once, then never again in the same run', async () => {
    const s = session({expiresAt: new Date(NOW + 30 * 60_000).toISOString()})
    const {hits, fetchFn} = tokenEndpoint([{body: ROTATED}])
    const refresher = new SessionRefresher(s, async () => HUB, {...store(s).deps, fetch: fetchFn, now: () => NOW})
    expect(await refresher.afterUnauthorized()).toBe('access-new')
    expect(await refresher.afterUnauthorized()).toBeUndefined()
    expect(hits.length).toBe(1)
  })

  it('invalid_grant: clears the tokens and says to run norbix login (exit 4), and does not ask again', async () => {
    const s = session()
    const {box, deps} = store(s)
    const {hits, fetchFn} = tokenEndpoint([{status: 400, body: {error: 'invalid_grant', error_description: 'revoked'}}])
    const refresher = new SessionRefresher(s, async () => HUB, {...deps, fetch: fetchFn, now: () => NOW})

    const error = (await refresher.ensureFresh().catch((e: unknown) => e)) as CliError
    expect(error).toBeInstanceOf(CliError)
    expect({exit: error.exit, code: error.code, hint: error.hint}).toEqual({
      exit: EXIT.AUTH,
      code: 'SESSION_EXPIRED',
      hint: 'Run `norbix login` to sign in again.',
    })
    expect(error.message).not.toContain('refresh-old')
    expect(box.cleared).toBe(true)

    await expect(refresher.ensureFresh()).rejects.toBe(error)
    expect(hits.length).toBe(1)
  })

  it('a server error keeps the tokens', async () => {
    const s = session()
    const {box, deps} = store(s)
    const {fetchFn} = tokenEndpoint([{status: 503, body: {}}])
    const refresher = new SessionRefresher(s, async () => HUB, {...deps, fetch: fetchFn, now: () => NOW})
    const error = (await refresher.ensureFresh().catch((e: unknown) => e)) as CliError
    expect(error.exit).toBe(EXIT.SERVER)
    expect(box.cleared).toBe(false)
  })

  it('another terminal already rotated the token: uses the stored one, sends nothing', async () => {
    const s = session()
    const newer = session({bearerToken: 'access-other', refreshToken: 'refresh-other', expiresAt: new Date(NOW + 3_600_000).toISOString()})
    const {hits, fetchFn} = tokenEndpoint([])
    const refresher = new SessionRefresher(s, async () => HUB, {...store(newer).deps, fetch: fetchFn, now: () => NOW})
    expect(await refresher.ensureFresh()).toBe('access-other')
    expect(hits).toEqual([])
  })
})

describe('revokeSession', () => {
  it('revokes the refresh token through {hub}/{version}/oauth/revoke (RFC 7009)', async () => {
    const {hits, fetchFn} = tokenEndpoint([{body: {}}])
    expect(await revokeSession(session(), HUB, fetchFn)).toBe('revoked')
    expect(hits).toEqual([
      {url: 'https://hub.test/v3/oauth/revoke', body: 'token=refresh-old&token_type_hint=refresh_token&client_id=norbix-cli'},
    ])
  })

  it('an older Hub (404) or a failure never throws', async () => {
    expect(await revokeSession(session(), HUB, tokenEndpoint([{status: 404, body: {}}]).fetchFn)).toBe('unsupported')
    expect(await revokeSession(session(), HUB, tokenEndpoint([{status: 500, body: {}}]).fetchFn)).toBe('failed')
    expect(await revokeSession(session({clientId: undefined}), HUB, tokenEndpoint([]).fetchFn)).toBe('skipped')
  })

  it('the dry-run request hides the token', () => {
    expect(revokeRequest(session(), HUB)).toEqual({
      method: 'POST',
      url: 'https://hub.test/v3/oauth/revoke',
      body: {token: '***', token_type_hint: 'refresh_token', client_id: 'norbix-cli'},
    })
  })
})
