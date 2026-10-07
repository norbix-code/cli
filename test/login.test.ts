import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

import {Config} from '@oclif/core'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {BaseCommand} from '../src/base.js'
import Login from '../src/commands/login.js'
import {CliError} from '../src/lib/cli-error.js'
import {NORBIX_DIR, PROFILES_PATH, SESSION_PATH} from '../src/lib/profiles.js'

/**
 * `norbix login` (browser sign-in) in a terminal, against a mocked Hub that
 * follows the contract in the gateway task file docs/tasks/cli-browser-sign-in.md.
 * The prompt and the browser are stubbed; HOME is the test sandbox.
 */

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(async ({message}: {message: string}) => (message.startsWith('User') ? 'alice@example.com' : '')),
  password: vi.fn(async () => 'pw'),
}))

const opened: string[] = []
const machine = {desktop: true}
vi.mock('../src/lib/device-login.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/lib/device-login.js')>()
  return {...original, canOpenBrowser: () => machine.desktop, openBrowser: (url: string) => opened.push(url)}
})

interface Hit {
  method: string
  url: string
  body: unknown
}

type Answer = {status?: number; body: unknown}

/** Fake Hub + API: answers per path from a queue, records every call. */
function stubNetwork(routes: Record<string, Answer[]>): Hit[] {
  const hits: Hit[] = []
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const raw = init?.body ? String(init.body) : undefined
    let body: unknown = raw
    try {
      body = raw ? JSON.parse(raw) : undefined
    } catch {
      /* form body */
    }

    hits.push({method: init?.method ?? 'GET', url, body})
    const path = Object.keys(routes).find((p) => new URL(url).pathname === p)
    const next = path ? routes[path].shift() : undefined
    if (!next) return new Response('{}', {status: 404})
    return new Response(JSON.stringify(next.body), {status: next.status ?? 200, headers: {'content-type': 'application/json'}})
  })
  return hits
}

const START = {
  deviceCode: 'dc-1',
  userCode: 'BCDF-GHJK',
  verificationUri: 'http://cloud.test/device',
  verificationUriComplete: 'http://cloud.test/device?code=BCDF-GHJK',
  expiresIn: 600,
  interval: 0, // the test does not wait; the interval logic is covered in device-login.test.ts
}

const SUCCESS = {
  bearerToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresIn: 3600,
  clientId: 'norbix-cli',
  userId: 'u-ai-1',
  userName: 'norbix-cli-mac',
  displayName: 'Norbix CLI (mac)',
  accountId: 'acc-1',
  projectId: 'p1',
}

let output: string[]

async function runLogin(argv: string[] = []): Promise<unknown> {
  const config = await Config.load(fileURLToPath(new URL('..', import.meta.url)))
  return Login.run(argv, config)
}

beforeEach(() => {
  output = []
  opened.length = 0
  machine.desktop = true
  mkdirSync(NORBIX_DIR, {recursive: true})
  writeFileSync(PROFILES_PATH, '[default]\nproject_id = p1\nhub_url = http://hub.test\napi_url = http://api.test\n')
  rmSync(SESSION_PATH, {force: true})
  vi.spyOn(BaseCommand.prototype as unknown as {isInteractive: () => boolean}, 'isInteractive').mockReturnValue(true)
  vi.spyOn(BaseCommand.prototype as unknown as {log: (m?: string) => void}, 'log').mockImplementation((m?: string) => {
    output.push(m ?? '')
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete process.env.NORBIX_HUB_URL
  delete process.env.NORBIX_API_URL
})

describe('norbix login (browser sign-in)', () => {
  it('asks the Hub for its version, starts the device flow there, polls, and stores the AI service user session', async () => {
    const hits = stubNetwork({
      '/v3/echo': [{body: {hubVersion: 'v3'}}],
      '/v3/auth/device/start': [{body: START}],
      '/v3/auth/device/token': [{body: {error: 'authorization_pending'}}, {body: SUCCESS}],
    })
    const before = Date.now()
    const result = await runLogin()

    expect(hits.map((h) => `${h.method} ${h.url}`)).toEqual([
      'GET http://hub.test/v3/echo',
      'POST http://hub.test/v3/auth/device/start',
      'POST http://hub.test/v3/auth/device/token',
      'POST http://hub.test/v3/auth/device/token',
    ])
    const startBody = hits[1].body as {clientName: string; deviceName?: string; projectId?: string}
    expect(startBody.clientName).toBe('norbix-cli')
    expect(startBody.projectId).toBe('p1')
    expect(typeof startBody.deviceName).toBe('string')
    expect(hits[2].body).toEqual({deviceCode: 'dc-1'})

    // The code is shown on its own line, the browser opens the complete link.
    expect(output).toContain('  Your one-time code:  BCDF-GHJK')
    expect(output).toContain('Approve this sign-in on the Norbix dashboard: http://cloud.test/device?code=BCDF-GHJK')
    expect(opened).toEqual(['http://cloud.test/device?code=BCDF-GHJK'])
    const done = output.at(-1)!.split('\n')
    expect(done[0]).toBe('Signed in as Norbix CLI (mac) (norbix-cli-mac) — an AI service user with the roles you picked.')
    expect(done[1]).toBe('Remove it any time in the dashboard: Account → AI service users.')
    expect(output.join('\n')).not.toMatch(/access-1|refresh-1/)

    const session = JSON.parse(readFileSync(SESSION_PATH, 'utf8')) as Record<string, string>
    expect({...session, expiresAt: undefined, savedAt: undefined}).toEqual({
      bearerToken: 'access-1',
      refreshToken: 'refresh-1',
      clientId: 'norbix-cli',
      method: 'browser',
      hubVersion: 'v3',
      hubUrl: 'http://hub.test',
      apiUrl: 'http://api.test',
      projectId: 'p1',
      accountId: 'acc-1',
      userId: 'u-ai-1',
      userName: 'norbix-cli-mac',
      displayName: 'Norbix CLI (mac)',
      expiresAt: undefined,
      savedAt: undefined,
    })
    const ttl = Date.parse(session.expiresAt) - before
    expect(ttl).toBeGreaterThanOrEqual(3_600_000)
    expect(ttl).toBeLessThan(3_600_000 + 60_000)
    expect(result).toMatchObject({method: 'browser', userName: 'norbix-cli-mac', accountId: 'acc-1'})
  })

  it('uses the version the Hub reports — never a fixed v2', async () => {
    const hits = stubNetwork({
      '/v3/echo': [{body: {hubVersion: 'v4'}}],
      '/v4/auth/device/start': [{body: START}],
      '/v4/auth/device/token': [{body: SUCCESS}],
    })
    await runLogin()
    expect(hits.map((h) => new URL(h.url).pathname)).toEqual(['/v3/echo', '/v4/auth/device/start', '/v4/auth/device/token'])
    expect(JSON.parse(readFileSync(SESSION_PATH, 'utf8')).hubVersion).toBe('v4')
  })

  it('signs in on the Hub NORBIX_HUB_URL names (with its /vN) and remembers it for later commands', async () => {
    process.env.NORBIX_HUB_URL = 'https://hub.finlo.space/v3'
    process.env.NORBIX_API_URL = 'https://api.finlo.space/v3'
    const hits = stubNetwork({
      '/v3/auth/device/start': [{body: START}],
      '/v3/auth/device/token': [{body: SUCCESS}],
    })
    await runLogin()
    // The version came with the URL: no /echo call, nothing sent to the profile's hub.test.
    expect(hits.map((h) => `${h.method} ${h.url}`)).toEqual([
      'POST https://hub.finlo.space/v3/auth/device/start',
      'POST https://hub.finlo.space/v3/auth/device/token',
    ])
    const session = JSON.parse(readFileSync(SESSION_PATH, 'utf8')) as Record<string, string>
    expect([session.hubUrl, session.apiUrl, session.hubVersion]).toEqual(['https://hub.finlo.space', 'https://api.finlo.space', 'v3'])
  })

  it('a denial in the browser ends with exit 4 and stores nothing', async () => {
    stubNetwork({
      '/v3/echo': [{body: {hubVersion: 'v3'}}],
      '/v3/auth/device/start': [{body: START}],
      '/v3/auth/device/token': [{body: {error: 'access_denied'}}],
    })
    const error = (await runLogin().catch((e: unknown) => e)) as CliError
    expect(error).toBeInstanceOf(CliError)
    expect([error.exit, error.code]).toEqual([4, 'ACCESS_DENIED'])
    expect(existsSync(SESSION_PATH)).toBe(false)
  })

  it('a machine without a desktop: no ENTER prompt, no browser, the link is printed and the CLI keeps waiting', async () => {
    machine.desktop = false
    const prompts = await import('@inquirer/prompts')
    vi.mocked(prompts.input).mockClear()
    stubNetwork({
      '/v3/echo': [{body: {hubVersion: 'v3'}}],
      '/v3/auth/device/start': [{body: START}],
      '/v3/auth/device/token': [{body: {error: 'authorization_pending'}}, {body: SUCCESS}],
    })
    await runLogin()

    expect(opened).toEqual([])
    expect(prompts.input).not.toHaveBeenCalled()
    expect(output).toContain('Approve this sign-in on the Norbix dashboard: http://cloud.test/device?code=BCDF-GHJK')
    expect(output).toContain('No desktop here to open a browser: open the link on any other device.')
    expect(JSON.parse(readFileSync(SESSION_PATH, 'utf8')).bearerToken).toBe('access-1')
  })

  it('a Hub without device sign-in: a usage error that points at --api-key, no password fallback', async () => {
    const hits = stubNetwork({
      '/v3/echo': [{body: {hubVersion: 'v3'}}],
      '/v3/auth/device/start': [{status: 404, body: {}}],
    })
    const error = (await runLogin().catch((e: unknown) => e)) as CliError
    expect(error).toBeInstanceOf(CliError)
    expect([error.exit, error.code]).toEqual([2, 'USAGE_ERROR'])
    expect(error.hint).toMatch(/--api-key/)
    expect(hits.map((h) => new URL(h.url).pathname)).toEqual(['/v3/echo', '/v3/auth/device/start'])
    expect(existsSync(SESSION_PATH)).toBe(false)
  })

  it('--user and --password are gone', async () => {
    const error = (await runLogin(['--user', 'alice@example.com']).catch((e: unknown) => e)) as Error
    expect(error.message).toMatch(/Nonexistent flag: --user/)
  })
})

describe('norbix login --api-key', () => {
  it('saves the key, the project and the self-hosted hosts into the named profile', async () => {
    await runLogin(['--api-key', 'nbsu_k1', '--project', 'p9', '--profile', 'ci', '--api-url', 'http://localhost:5002', '--hub-url', 'http://localhost:5001'])
    const ini = readFileSync(PROFILES_PATH, 'utf8')
    expect(ini).toContain('[ci]\napi_key = nbsu_k1\nproject_id = p9\napi_url = http://localhost:5002\nhub_url = http://localhost:5001\n')
  })

  it('takes the hosts from NORBIX_API_URL / NORBIX_HUB_URL when no flag is given', async () => {
    process.env.NORBIX_API_URL = 'https://api.example.com'
    process.env.NORBIX_HUB_URL = 'https://hub.example.com'
    await runLogin(['--api-key', 'nbsu_k1', '--project', 'p9', '--profile', 'ci'])
    const ini = readFileSync(PROFILES_PATH, 'utf8')
    expect(ini).toContain('api_url = https://api.example.com\nhub_url = https://hub.example.com')
  })

  it('--api-url without --api-key is a usage error', async () => {
    const error = (await runLogin(['--api-url', 'http://localhost:5002']).catch((e: unknown) => e)) as CliError
    expect([error.exit, error.code]).toEqual([2, 'USAGE_ERROR'])
  })

})
