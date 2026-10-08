import {existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import http from 'node:http'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {cli, parseSingleJson} from './_cli.js'

/**
 * Token refresh, seen from outside: the BUILT CLI runs against a fake Hub with
 * a browser sign-in on disk. The access token is refreshed through
 * `/{v}/oauth/token` before it expires, or once after a 401; an ended grant
 * clears the session and exits 4. No token ever appears in the output.
 */

interface Hit {
  method: string
  url: string
  auth?: string
  body: string
}

let port = 0
let server: http.Server
const hits: Hit[] = []
/** What the fake Hub does — set per test. */
let mode: {token: 'rotate' | 'invalid_grant'; rejectOld: boolean} = {token: 'rotate', rejectOld: false}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      const url = req.url ?? ''
      res.setHeader('content-type', 'application/json')
      // Discovery of `host = 127.0.0.1:<port>` — not a hit.
      if (url === '/.well-known/norbix.json') {
        res.statusCode = 404
        return res.end('{}')
      }

      if (url === '/v3/echo') {
        const self = `http://127.0.0.1:${port}/v3`
        return res.end(JSON.stringify({hubUrl: self, apiUrl: self, hubVersion: 'v3', apiVersion: 'v3'}))
      }

      hits.push({method: req.method ?? '', url, auth: req.headers.authorization, body})
      if (url === '/v3/oauth/token') {
        if (mode.token === 'invalid_grant') {
          res.statusCode = 400
          return res.end('{"error":"invalid_grant","error_description":"The refresh token is not valid."}')
        }

        return res.end('{"access_token":"access-new","token_type":"Bearer","expires_in":3600,"refresh_token":"refresh-new","scope":""}')
      }

      if (mode.rejectOld && req.headers.authorization === 'Bearer access-old') {
        res.statusCode = 401
        return res.end('{"responseStatus":{"errorCode":"Unauthorized","message":"Token expired"}}')
      }

      res.end('{"item":{"environments":["PROD"]}}')
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  port = typeof address === 'object' && address ? address.port : 0
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

let home: string

/** A HOME with a [default] profile for the fake Hub's host and its browser sign-in. */
function makeHome(secondsLeft: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'norbix-refresh-'))
  mkdirSync(join(dir, '.norbix', 'sessions'), {recursive: true})
  writeFileSync(join(dir, '.norbix', 'config'), ['[default]', `host=127.0.0.1:${port}`, 'project_id=p1', ''].join('\n'))
  writeFileSync(
    join(dir, '.norbix', 'sessions', `127.0.0.1_${port}.json`),
    JSON.stringify({
      hubUrl: `http://127.0.0.1:${port}`,
      host: `127.0.0.1:${port}`,
      bearerToken: 'access-old',
      refreshToken: 'refresh-old',
      clientId: 'norbix-cli',
      method: 'browser',
      hubVersion: 'v3',
      userId: 'u1',
      userName: 'norbix-cli-mac',
      displayName: 'Norbix CLI (mac)',
      expiresAt: new Date(Date.now() + secondsLeft * 1000).toISOString(),
    }),
  )
  return dir
}

const sessionFile = () => join(home, '.norbix', 'sessions', `127.0.0.1_${port}.json`)
const readStored = () => JSON.parse(readFileSync(sessionFile(), 'utf8')) as Record<string, string>

function expectNoTokens(text: string): void {
  for (const secret of ['access-old', 'access-new', 'refresh-old', 'refresh-new']) expect(text).not.toContain(secret)
}

beforeEach(() => {
  hits.length = 0
  mode = {token: 'rotate', rejectOld: false}
})

describe('token refresh', () => {
  it('refreshes a token that expires within 60 s before the call, and stores the rotated pair', async () => {
    home = makeHome(30)
    const r = await cli(home, ['env', 'list', '--json'])
    expect(r.code).toBe(0)

    expect(hits.map((h) => `${h.method} ${h.url.split('?')[0]} ${h.auth ?? '-'}`)).toEqual([
      'POST /v3/oauth/token -',
      `GET ${hits[1].url.split('?')[0]} Bearer access-new`,
    ])
    expect(hits[0].body).toBe('grant_type=refresh_token&refresh_token=refresh-old&client_id=norbix-cli')

    const stored = readStored()
    expect(stored.bearerToken).toBe('access-new')
    expect(stored.refreshToken).toBe('refresh-new')
    expect(Date.parse(stored.expiresAt) - Date.now()).toBeGreaterThan(3_500_000)
    expectNoTokens(r.stdout + r.stderr)
  })

  it('a 401 refreshes once and retries the call with the new token', async () => {
    home = makeHome(30 * 60)
    mode.rejectOld = true
    const r = await cli(home, ['env', 'list', '--json'])
    expect(r.code).toBe(0)
    expect(hits.map((h) => `${h.url.startsWith('/v3/oauth') ? h.url : 'call'} ${h.auth ?? '-'}`)).toEqual([
      'call Bearer access-old',
      '/v3/oauth/token -',
      'call Bearer access-new',
    ])
    expect(readStored().refreshToken).toBe('refresh-new')
    expectNoTokens(r.stdout + r.stderr)
  })

  it('invalid_grant: clears the session, exits 4 and says to run norbix login', async () => {
    home = makeHome(-60)
    mode.token = 'invalid_grant'
    const r = await cli(home, ['env', 'list', '--json'])
    expect(r.code).toBe(4)
    const err = (parseSingleJson(r.stdout) as {error: {code: string; message: string; hint: string; exit: number}}).error
    expect({code: err.code, exit: err.exit, hint: err.hint}).toEqual({
      code: 'SESSION_EXPIRED',
      exit: 4,
      hint: 'Run `norbix login` to sign in again.',
    })
    expect(err.message).toMatch(/sign-in has ended \(invalid_grant\)/)
    // One refresh attempt, no call with the dead token.
    expect(hits.map((h) => h.url)).toEqual(['/v3/oauth/token'])
    expect(existsSync(sessionFile())).toBe(false)
    expectNoTokens(r.stdout + r.stderr)
  })

  it('--dry-run sends nothing and refreshes nothing', async () => {
    home = makeHome(30)
    const r = await cli(home, ['env', 'delete', 'TEST', '--dry-run', '--json'])
    expect(r.code).toBe(0)
    expect(hits).toEqual([])
    expect(readStored().refreshToken).toBe('refresh-old')
  })
})

describe('NORBIX_HOST', () => {
  it('points every call at the Hub the host leads to, without editing ~/.norbix/config', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'norbix-env-host-'))
    const r = await cli(dir, ['env', 'list', '--api-key', 'k', '--project', 'p1', '--json'], {NORBIX_HOST: `127.0.0.1:${port}`})
    expect(r.code).toBe(0)
    expect(r.stderr).toBe('')
    expect(hits.map((h) => h.url.split('?')[0])).toEqual(['/v3/account/projects/environments'])
    expect(hits[0].auth).toBe('Bearer k')
  })
})

describe('NORBIX_HUB_URL / NORBIX_API_URL (deprecated, one more release)', () => {
  it('point every call at that install, with the version from the URL, and warn on stderr', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'norbix-env-urls-'))
    const r = await cli(dir, ['env', 'list', '--api-key', 'k', '--project', 'p1', '--json'], {
      NORBIX_HUB_URL: `http://127.0.0.1:${port}/v3`,
      NORBIX_API_URL: `http://127.0.0.1:${port}/v3/`,
    })
    expect(r.code).toBe(0)
    expect(hits.map((h) => h.url.split('?')[0])).toEqual(['/v3/account/projects/environments'])
    expect(hits[0].auth).toBe('Bearer k')
    expect(r.stderr).toContain('Warning: NORBIX_HUB_URL is deprecated')
    expect(r.stderr).toContain('Warning: NORBIX_API_URL is deprecated')
    parseSingleJson(r.stdout) // stdout is still one JSON document
  })
})

describe('whoami and logout with a browser sign-in', () => {
  it('whoami shows the AI service user and the expiry, never the tokens', async () => {
    home = makeHome(30 * 60)
    const r = await cli(home, ['whoami', '--json'])
    expect(r.code).toBe(0)
    const doc = parseSingleJson(r.stdout) as {session: Record<string, unknown>; verified: boolean}
    expect(doc.verified).toBe(true)
    expect(doc.session).toMatchObject({
      method: 'browser',
      aiServiceUser: true,
      userName: 'norbix-cli-mac',
      displayName: 'Norbix CLI (mac)',
      refreshes: true,
    })
    expect(Date.parse(String(doc.session.expiresAt))).toBeGreaterThan(Date.now())
    expectNoTokens(r.stdout + r.stderr)

    const text = await cli(home, ['whoami'])
    expect(text.stdout).toContain('User:     Norbix CLI (mac) — AI service user (remove it in the dashboard: Account → AI service users)')
    expect(text.stdout).toMatch(/Token: {4}expires \S+ \(in \d+ min\), refreshed by itself/)
  })

  it('logout revokes the refresh token on the Hub, then removes the session', async () => {
    home = makeHome(30 * 60)
    const r = await cli(home, ['logout', '--json'])
    expect(r.code).toBe(0)
    expect(parseSingleJson(r.stdout)).toEqual({
      loggedOut: true,
      revoked: 'revoked',
      sessions: [{hub: `127.0.0.1_${port}`, host: `127.0.0.1:${port}`, revoked: 'revoked'}],
    })
    expect(hits.map((h) => `${h.method} ${h.url}`)).toEqual(['POST /v3/oauth/revoke'])
    expect(hits[0].body).toBe('token=refresh-old&token_type_hint=refresh_token&client_id=norbix-cli')
    expect(existsSync(sessionFile())).toBe(false)
  })

  it('logout --dry-run shows the revoke request with the token hidden', async () => {
    home = makeHome(30 * 60)
    const r = await cli(home, ['logout', '--dry-run', '--json'])
    expect(r.code).toBe(0)
    const doc = parseSingleJson(r.stdout) as {http: {url: string; body: Record<string, string>}}
    expect(doc.http.url).toBe(`http://127.0.0.1:${port}/v3/oauth/revoke`)
    expect(doc.http.body.token).toBe('***')
    expect(hits).toEqual([])
    expect(existsSync(sessionFile())).toBe(true)
    expectNoTokens(r.stdout + r.stderr)
  })
})
