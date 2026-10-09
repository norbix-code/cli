import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

import {Config} from '@oclif/core'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {BaseCommand} from '../src/base.js'
import Login from '../src/commands/login.js'
import {CliError} from '../src/lib/cli-error.js'
import {HOSTS_DIR} from '../src/lib/hosts.js'
import {NORBIX_DIR, PROFILES_PATH, SESSIONS_DIR, pendingPath, sessionPath} from '../src/lib/profiles.js'
import {ownerOnly, seedDefaultHost} from './seed.js'

/**
 * `norbix login` against a mocked host + Hub that follows the gateway
 * contracts: /.well-known/norbix.json (discovery), /{v}/echo and the device
 * sign-in of docs/tasks/cli-browser-sign-in.md. The prompt and the browser
 * are stubbed; HOME is the test sandbox.
 */

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(async () => ''),
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

/** Fake hosts: answers per `host + path` (or path alone) from a queue, records every call. */
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
    const u = new URL(url)
    const key = [`${u.host}${u.pathname}`, u.pathname].find((k) => routes[k]?.length)
    const next = key ? routes[key].shift() : undefined
    if (!next) return new Response('{}', {status: 404})
    const text = typeof next.body === 'string' ? next.body : JSON.stringify(next.body)
    return new Response(text, {status: next.status ?? 200, headers: {'content-type': 'application/json'}})
  })
  return hits
}

/** /echo of the Hub at https://hub.example.com. */
const ECHO = {hubUrl: 'https://hub.example.com/v3', apiUrl: 'https://api.example.com/v3', hubVersion: 'v3', apiVersion: 'v3', regions: []}

const START = {
  deviceCode: 'dc-1',
  userCode: 'BCDF-GHJK',
  verificationUri: 'https://cloud.example.com/device',
  verificationUriComplete: 'https://cloud.example.com/device?code=BCDF-GHJK',
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

const HUB_SESSION = () => sessionPath('hub.example.com')
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>

let output: string[]
let interactive: boolean

async function runLogin(argv: string[] = []): Promise<unknown> {
  const config = await Config.load(fileURLToPath(new URL('..', import.meta.url)))
  return Login.run(argv, config)
}

beforeEach(() => {
  output = []
  opened.length = 0
  machine.desktop = true
  interactive = true
  for (const dir of [SESSIONS_DIR, HOSTS_DIR]) rmSync(dir, {recursive: true, force: true})
  mkdirSync(NORBIX_DIR, {recursive: true})
  seedDefaultHost(homedir())
  writeFileSync(PROFILES_PATH, '[default]\nhost = hub.example.com\nproject_id = p1\n')
  vi.spyOn(BaseCommand.prototype as unknown as {isInteractive: () => boolean}, 'isInteractive').mockImplementation(() => interactive)
  vi.spyOn(BaseCommand.prototype as unknown as {log: (m?: string) => void}, 'log').mockImplementation((m?: string) => {
    output.push(m ?? '')
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const name of ['NORBIX_HUB_URL', 'NORBIX_API_URL', 'NORBIX_HOST']) delete process.env[name]
})

describe('norbix login (browser sign-in)', () => {
  it('discovers the Hub, starts the device flow there, polls, and stores the session under the Hub host', async () => {
    const hits = stubNetwork({
      '/v3/echo': [{body: ECHO}],
      '/v3/auth/device/start': [{body: START}],
      '/v3/auth/device/token': [{body: {error: 'authorization_pending'}}, {body: SUCCESS}],
    })
    const before = Date.now()
    const result = await runLogin()

    expect(hits.map((h) => `${h.method} ${h.url}`)).toEqual([
      'GET https://hub.example.com/.well-known/norbix.json',
      'GET https://hub.example.com/v3/echo',
      'POST https://hub.example.com/v3/auth/device/start',
      'POST https://hub.example.com/v3/auth/device/token',
      'POST https://hub.example.com/v3/auth/device/token',
    ])
    const startBody = hits[2].body as {clientName: string; deviceName?: string; projectId?: string}
    expect(startBody.clientName).toBe('norbix-cli')
    expect(startBody.projectId).toBe('p1')
    expect(typeof startBody.deviceName).toBe('string')
    expect(hits[3].body).toEqual({deviceCode: 'dc-1'})

    // The code is shown on its own line, the browser opens the complete link.
    expect(output).toContain('  Your one-time code:  BCDF-GHJK')
    expect(output).toContain('Approve this sign-in on the Norbix dashboard: https://cloud.example.com/device?code=BCDF-GHJK')
    expect(opened).toEqual(['https://cloud.example.com/device?code=BCDF-GHJK'])
    const done = output.at(-1)!.split('\n')
    expect(done[0]).toBe('Signed in to hub.example.com as Norbix CLI (mac) (norbix-cli-mac) — an AI service user with the roles you picked.')
    expect(done[2]).toBe(`Session saved to ${join(SESSIONS_DIR, 'hub.example.com.json')}.`)
    expect(output.join('\n')).not.toMatch(/access-1|refresh-1/)

    const session = readJson(HUB_SESSION())
    expect({...session, expiresAt: undefined, savedAt: undefined}).toEqual({
      bearerToken: 'access-1',
      refreshToken: 'refresh-1',
      clientId: 'norbix-cli',
      method: 'browser',
      hubVersion: 'v3',
      hubUrl: 'https://hub.example.com',
      apiUrl: 'https://api.example.com/v3',
      host: 'hub.example.com',
      projectId: 'p1',
      accountId: 'acc-1',
      userId: 'u-ai-1',
      userName: 'norbix-cli-mac',
      displayName: 'Norbix CLI (mac)',
      expiresAt: undefined,
      savedAt: undefined,
    })
    expect(ownerOnly(HUB_SESSION())).toBe(true)
    const ttl = Date.parse(String(session.expiresAt)) - before
    expect(ttl).toBeGreaterThanOrEqual(3_600_000)
    expect(ttl).toBeLessThan(3_600_000 + 60_000)
    expect(result).toMatchObject({status: 'signed-in', host: 'hub.example.com', hub: 'hub.example.com', userName: 'norbix-cli-mac'})
  })

  it('no project chosen and the account has one: it is saved into the session and named', async () => {
    writeFileSync(PROFILES_PATH, '[default]\nhost = hub.example.com\n')
    const hits = stubNetwork({
      '/v3/echo': [{body: ECHO}],
      '/v3/auth/device/start': [{body: START}],
      '/v3/auth/device/token': [{body: {...SUCCESS, projectId: undefined}}],
      '/v3/account/projects': [{body: {list: [{viewId: 'p-only', name: 'Finlo', uniqueName: 'finlo'}]}}],
    })
    const result = await runLogin()
    expect(hits.at(-1)).toMatchObject({method: 'GET', url: 'https://hub.example.com/v3/account/projects'})
    expect(readJson(HUB_SESSION()).projectId).toBe('p-only')
    expect(output.at(-1)).toBe('Project: Finlo (p-only) — the only project of this account, saved to the sign-in.')
    expect(result).toMatchObject({status: 'signed-in', projectId: 'p-only'})
  })

  it('no project chosen and the account has several: they are listed with how to pick one, nothing is saved', async () => {
    writeFileSync(PROFILES_PATH, '[default]\nhost = hub.example.com\n')
    stubNetwork({
      '/v3/echo': [{body: ECHO}],
      '/v3/auth/device/start': [{body: START}],
      '/v3/auth/device/token': [{body: {...SUCCESS, projectId: undefined}}],
      '/v3/account/projects': [{body: {list: [{viewId: 'p-a', name: 'Alpha'}, {viewId: 'p-b', name: 'Beta'}]}}],
    })
    const result = await runLogin()
    expect(readJson(HUB_SESSION()).projectId).toBeUndefined()
    expect(output.at(-1)).toBe(
      'This account has 2 projects and none is chosen yet. Pick one: norbix config set project_id <id>, or pass --project <id> / set NORBIX_PROJECT_ID.\n  p-a  Alpha\n  p-b  Beta',
    )
    expect(result).toMatchObject({status: 'signed-in', projects: [{id: 'p-a', name: 'Alpha'}, {id: 'p-b', name: 'Beta'}]})
  })

  it('hub.norbix.ai with no region: the projects are read from the account Hub, and the project is saved with its region', async () => {
    rmSync(HOSTS_DIR, {recursive: true, force: true}) // no built-in cache: hub.norbix.ai is discovered like any host
    writeFileSync(PROFILES_PATH, '[default]\n')
    const NORBIX_ECHO = {hubUrl: 'https://hub.norbix.ai/v3', apiUrl: 'https://api.norbix.ai/v3', hubVersion: 'v3', apiVersion: 'v3', regions: []}
    const hits = stubNetwork({
      'hub.norbix.ai/.well-known/norbix.json': [{body: {hubUrl: 'https://hub.norbix.ai/v3'}}],
      'hub.norbix.ai/v3/echo': [{body: NORBIX_ECHO}],
      'hub.norbix.ai/v3/auth/device/start': [{body: START}],
      'hub.norbix.ai/v3/auth/device/token': [{body: {...SUCCESS, projectId: undefined}}],
      'hub.norbix.ai/v3/account/projects': [
        {body: {list: [{viewId: 'p-only', name: 'Finlo', primaryRegion: {id: 'nb-eu-germany', name: 'Germany'}}]}},
      ],
    })
    const result = await runLogin()
    const lookup = hits.at(-1)!
    expect(lookup).toMatchObject({method: 'GET', url: 'https://hub.norbix.ai/v3/account/projects'}) // not <region>.hub.norbix.ai
    const session = readJson(sessionPath('hub.norbix.ai'))
    expect([session.projectId, session.region]).toEqual(['p-only', 'nb-eu-germany'])
    expect(output.at(-1)).toBe('Project: Finlo (p-only) (region nb-eu-germany) — the only project of this account, saved to the sign-in.')
    expect(result).toMatchObject({status: 'signed-in', projectId: 'p-only', region: 'nb-eu-germany'})
  })

  it('a self-hosted Hub: the project is saved without a region, even when the Hub names one', async () => {
    writeFileSync(PROFILES_PATH, '[default]\nhost = hub.example.com\n')
    const hits = stubNetwork({
      '/v3/echo': [{body: ECHO}],
      '/v3/auth/device/start': [{body: START}],
      '/v3/auth/device/token': [{body: {...SUCCESS, projectId: undefined}}],
      '/v3/account/projects': [{body: {list: [{viewId: 'p-only', name: 'Finlo', primaryRegion: {id: 'nb-eu-germany'}}]}}],
    })
    const result = await runLogin()
    expect(hits.at(-1)).toMatchObject({method: 'GET', url: 'https://hub.example.com/v3/account/projects'})
    const session = readJson(HUB_SESSION())
    expect([session.projectId, session.region]).toEqual(['p-only', undefined])
    expect(result).not.toHaveProperty('region')
  })

  it('a sign-in that has a project does not ask for the projects', async () => {
    const hits = stubNetwork({
      '/v3/echo': [{body: ECHO}],
      '/v3/auth/device/start': [{body: START}],
      '/v3/auth/device/token': [{body: SUCCESS}],
    })
    await runLogin()
    expect(hits.some((h) => h.url.includes('/account/projects'))).toBe(false)
  })

  it('--host cloud.example.com: the well-known file names the Hub, and the sign-in is stored under the Hub, not the cloud host', async () => {
    const hits = stubNetwork({
      'cloud.example.com/.well-known/norbix.json': [{body: {hubUrl: 'https://hub.example.com/v3'}}],
      '/v3/echo': [{body: ECHO}],
      '/v3/auth/device/start': [{body: START}],
      '/v3/auth/device/token': [{body: SUCCESS}],
    })
    await runLogin(['--host', 'cloud.example.com'])
    expect(hits.map((h) => `${h.method} ${h.url}`).slice(0, 3)).toEqual([
      'GET https://cloud.example.com/.well-known/norbix.json',
      'GET https://hub.example.com/v3/echo',
      'POST https://hub.example.com/v3/auth/device/start',
    ])
    expect(readJson(HUB_SESSION()).host).toBe('cloud.example.com')
    expect(existsSync(sessionPath('cloud.example.com'))).toBe(false)
  })

  describe('login --host and the [default] profile', () => {
    const routes = () => ({
      'cloud.example.com/.well-known/norbix.json': [{body: {hubUrl: 'https://hub.example.com/v3'}}],
      '/v3/echo': [{body: ECHO}],
      '/v3/auth/device/start': [{body: START}],
      '/v3/auth/device/token': [{body: SUCCESS}],
    })

    it('with no [default] profile yet, the host is saved there, so plain commands use the sign-in', async () => {
      rmSync(PROFILES_PATH, {force: true})
      stubNetwork(routes())
      const result = (await runLogin(['--host', 'cloud.example.com'])) as {defaultProfile: string}
      expect(result.defaultProfile).toBe('created')
      expect(readFileSync(PROFILES_PATH, 'utf8')).toBe('[default]\nhost = cloud.example.com\n')
      expect(output.at(-1)!.split('\n').at(-1)).toBe('Saved host = cloud.example.com in profile [default]: later commands use this sign-in.')
    })

    it('an existing [default] for another host is left alone, and the note says how to switch', async () => {
      writeFileSync(PROFILES_PATH, '[default]\nproject_id = p-norbix\n')
      stubNetwork(routes())
      const result = (await runLogin(['--host', 'cloud.example.com'])) as {defaultProfile: string}
      expect(result.defaultProfile).toBe('other host')
      expect(readFileSync(PROFILES_PATH, 'utf8')).toBe('[default]\nproject_id = p-norbix\n')
      expect(output.at(-1)!.split('\n').at(-1)).toBe(
        'Commands without --host still use profile [default] (hub.norbix.ai). ' +
          'Use this sign-in with --host cloud.example.com or NORBIX_HOST=cloud.example.com, or make it the default: norbix config set host cloud.example.com',
      )
    })

    it('a [default] already for the same Hub (hub.x while signing in through cloud.x) needs nothing', async () => {
      stubNetwork(routes())
      const result = (await runLogin(['--host', 'cloud.example.com'])) as {defaultProfile: string}
      expect(result.defaultProfile).toBe('same host')
      expect(readFileSync(PROFILES_PATH, 'utf8')).toBe('[default]\nhost = hub.example.com\nproject_id = p1\n')
    })
  })

  it('uses the version the Hub reports — never a fixed v2', async () => {
    const hits = stubNetwork({
      '/v3/echo': [{body: {...ECHO, hubUrl: 'https://hub.example.com/v4', hubVersion: 'v4'}}],
      '/v4/auth/device/start': [{body: START}],
      '/v4/auth/device/token': [{body: SUCCESS}],
    })
    await runLogin()
    expect(hits.map((h) => new URL(h.url).pathname)).toEqual([
      '/.well-known/norbix.json',
      '/v3/echo',
      '/v4/auth/device/start',
      '/v4/auth/device/token',
    ])
    expect(readJson(HUB_SESSION()).hubVersion).toBe('v4')
  })

  it('deprecated NORBIX_HUB_URL / NORBIX_API_URL still sign in on that Hub, with no discovery', async () => {
    writeFileSync(PROFILES_PATH, '[default]\nproject_id = p1\n')
    process.env.NORBIX_HUB_URL = 'https://hub.finlo.space/v3'
    process.env.NORBIX_API_URL = 'https://api.finlo.space/v3'
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const hits = stubNetwork({
      '/v3/auth/device/start': [{body: START}],
      '/v3/auth/device/token': [{body: SUCCESS}],
    })
    await runLogin()
    expect(hits.map((h) => `${h.method} ${h.url}`)).toEqual([
      'POST https://hub.finlo.space/v3/auth/device/start',
      'POST https://hub.finlo.space/v3/auth/device/token',
    ])
    const session = readJson(sessionPath('hub.finlo.space'))
    expect([session.hubUrl, session.hubVersion]).toEqual(['https://hub.finlo.space', 'v3'])
    expect(stderr.mock.calls.map((c) => String(c[0])).join('')).toContain('Warning: NORBIX_HUB_URL is deprecated')
  })

  it('a denial in the browser ends with exit 4 and stores nothing', async () => {
    stubNetwork({
      '/v3/echo': [{body: ECHO}],
      '/v3/auth/device/start': [{body: START}],
      '/v3/auth/device/token': [{body: {error: 'access_denied'}}],
    })
    const error = (await runLogin().catch((e: unknown) => e)) as CliError
    expect(error).toBeInstanceOf(CliError)
    expect([error.exit, error.code]).toEqual([4, 'ACCESS_DENIED'])
    expect(existsSync(HUB_SESSION())).toBe(false)
  })

  it('a machine without a desktop (or over SSH): no ENTER prompt, no browser, the link is printed and the CLI keeps waiting', async () => {
    machine.desktop = false
    const prompts = await import('@inquirer/prompts')
    vi.mocked(prompts.input).mockClear()
    stubNetwork({
      '/v3/echo': [{body: ECHO}],
      '/v3/auth/device/start': [{body: START}],
      '/v3/auth/device/token': [{body: {error: 'authorization_pending'}}, {body: SUCCESS}],
    })
    await runLogin()

    expect(opened).toEqual([])
    expect(prompts.input).not.toHaveBeenCalled()
    expect(output).toContain('Approve this sign-in on the Norbix dashboard: https://cloud.example.com/device?code=BCDF-GHJK')
    expect(output).toContain('No browser is opened here: open the link on any device.')
    expect(readJson(HUB_SESSION()).bearerToken).toBe('access-1')
  })

  it('--no-browser without a terminal: never opens a browser, prints the link and waits', async () => {
    interactive = false
    stubNetwork({
      '/v3/echo': [{body: ECHO}],
      '/v3/auth/device/start': [{body: START}],
      '/v3/auth/device/token': [{body: SUCCESS}],
    })
    await runLogin(['--no-browser'])
    expect(opened).toEqual([])
    expect(output).toContain('No browser is opened here: open the link on any device.')
    expect(readJson(HUB_SESSION()).bearerToken).toBe('access-1')
  })

  it('no terminal and no --api-key / --no-browser / --wait: exit 2, the hint names --no-browser, nothing is sent', async () => {
    interactive = false
    const hits = stubNetwork({})
    const error = (await runLogin().catch((e: unknown) => e)) as CliError
    expect([error.exit, error.code]).toEqual([2, 'USAGE_ERROR'])
    expect(error.hint).toContain('norbix login --no-browser --json')
    expect(error.hint).toContain('NORBIX_HOST + NORBIX_API_KEY + NORBIX_PROJECT_ID')
    expect(hits).toEqual([])
  })

  it('a Hub without device sign-in: a usage error that points at --api-key, no password fallback', async () => {
    const hits = stubNetwork({
      '/v3/echo': [{body: ECHO}],
      '/v3/auth/device/start': [{status: 404, body: {}}],
    })
    const error = (await runLogin().catch((e: unknown) => e)) as CliError
    expect(error).toBeInstanceOf(CliError)
    expect([error.exit, error.code]).toEqual([2, 'USAGE_ERROR'])
    expect(error.hint).toMatch(/--api-key/)
    expect(hits.map((h) => new URL(h.url).pathname)).toEqual(['/.well-known/norbix.json', '/v3/echo', '/v3/auth/device/start'])
    expect(existsSync(HUB_SESSION())).toBe(false)
  })

  it('--user, --password, --api-url and --hub-url are gone', async () => {
    for (const flag of ['--user', '--password', '--api-url', '--hub-url']) {
      const error = (await runLogin([flag, 'x']).catch((e: unknown) => e)) as Error
      expect(error.message).toContain(`Nonexistent flag: ${flag}`)
    }
  })
})

describe('agent sign-in in two steps: --no-browser --json, then --wait', () => {
  /** A pending sign-in on disk, as step 1 leaves it. */
  function writePendingFile(over: Record<string, unknown> = {}): void {
    mkdirSync(SESSIONS_DIR, {recursive: true})
    writeFileSync(
      pendingPath('hub.example.com'),
      JSON.stringify({
        deviceCode: 'dc-1',
        userCode: 'BCDF-GHJK',
        verificationUri: 'https://cloud.example.com/device',
        verificationUriComplete: 'https://cloud.example.com/device?code=BCDF-GHJK',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        interval: 0,
        host: 'hub.example.com',
        hubUrl: 'https://hub.example.com',
        hubVersion: 'v3',
        projectId: 'p1',
        startedAt: new Date().toISOString(),
        ...over,
      }),
    )
  }

  it('step 1 starts the sign-in, saves the code (mode 600), prints the link and exits at once — no polling', async () => {
    interactive = false
    const hits = stubNetwork({'/v3/echo': [{body: ECHO}], '/v3/auth/device/start': [{body: START}]})
    const result = await runLogin(['--no-browser', '--json'])

    expect(result).toEqual({
      status: 'pending',
      host: 'hub.example.com',
      userCode: 'BCDF-GHJK',
      verificationUri: 'https://cloud.example.com/device',
      verificationUriComplete: 'https://cloud.example.com/device?code=BCDF-GHJK',
      expiresIn: 600,
      next: 'norbix login --wait',
    })
    expect(hits.map((h) => new URL(h.url).pathname)).toEqual(['/.well-known/norbix.json', '/v3/echo', '/v3/auth/device/start'])
    expect(opened).toEqual([])
    const pending = readJson(pendingPath('hub.example.com'))
    expect(pending).toMatchObject({deviceCode: 'dc-1', userCode: 'BCDF-GHJK', hubUrl: 'https://hub.example.com', hubVersion: 'v3', host: 'hub.example.com'})
    expect(ownerOnly(pendingPath('hub.example.com'))).toBe(true)
    expect(existsSync(HUB_SESSION())).toBe(false)
  })

  it('step 1 with --host names that host in the next step', async () => {
    interactive = false
    stubNetwork({
      'cloud.example.com/.well-known/norbix.json': [{body: {hubUrl: 'https://hub.example.com/v3'}}],
      '/v3/echo': [{body: ECHO}],
      '/v3/auth/device/start': [{body: START}],
    })
    const result = (await runLogin(['--no-browser', '--json', '--host', 'cloud.example.com'])) as {next: string}
    expect(result.next).toBe('norbix login --wait --host cloud.example.com')
    expect(existsSync(pendingPath('hub.example.com'))).toBe(true)
  })

  it('--wait: approved → the session is saved and the pending code removed', async () => {
    interactive = false
    writePendingFile()
    const hits = stubNetwork({
      '/v3/echo': [{body: ECHO}],
      '/v3/auth/device/token': [{body: {error: 'authorization_pending'}}, {body: SUCCESS}],
    })
    const result = await runLogin(['--wait', '--json'])
    expect(result).toMatchObject({status: 'signed-in', host: 'hub.example.com', userName: 'norbix-cli-mac'})
    expect(hits.filter((h) => h.url.endsWith('/auth/device/token')).map((h) => h.body)).toEqual([{deviceCode: 'dc-1'}, {deviceCode: 'dc-1'}])
    expect(readJson(HUB_SESSION())).toMatchObject({bearerToken: 'access-1', hubUrl: 'https://hub.example.com', host: 'hub.example.com', projectId: 'p1'})
    expect(existsSync(pendingPath('hub.example.com'))).toBe(false)
  })

  it('--wait: still pending after ~90 s → exit 4 AUTHORIZATION_PENDING, the code is kept, and a re-run finishes it', async () => {
    interactive = false
    writePendingFile()
    let now = Date.now()
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => (now += 20_000))
    stubNetwork({
      '/v3/echo': [{body: ECHO}],
      '/v3/auth/device/token': Array.from({length: 20}, () => ({body: {error: 'authorization_pending'}})),
    })
    const error = (await runLogin(['--wait', '--json']).catch((e: unknown) => e)) as CliError
    expect([error.exit, error.code]).toEqual([4, 'AUTHORIZATION_PENDING'])
    expect(error.message).toContain('https://cloud.example.com/device?code=BCDF-GHJK')
    expect(error.hint).toContain('norbix login --wait')
    expect(existsSync(pendingPath('hub.example.com'))).toBe(true)

    // Back to the real clock (the fake one stamped the host cache in the future, so it is fetched again).
    nowSpy.mockRestore()
    stubNetwork({'/v3/echo': [{body: ECHO}], '/v3/auth/device/token': [{body: SUCCESS}]})
    await runLogin(['--wait', '--json'])
    expect(readJson(HUB_SESSION()).bearerToken).toBe('access-1')
    expect(existsSync(pendingPath('hub.example.com'))).toBe(false)
  })

  it('--wait: the code ran out → exit 4 EXPIRED_TOKEN and the pending file is removed', async () => {
    interactive = false
    writePendingFile({expiresAt: new Date(Date.now() - 1000).toISOString()})
    const hits = stubNetwork({'/v3/echo': [{body: ECHO}]})
    const error = (await runLogin(['--wait', '--json']).catch((e: unknown) => e)) as CliError
    expect([error.exit, error.code]).toEqual([4, 'EXPIRED_TOKEN'])
    expect(existsSync(pendingPath('hub.example.com'))).toBe(false)
    expect(hits.some((h) => h.url.includes('/auth/device/token'))).toBe(false)
  })

  it('--wait: denied in the browser → exit 4 ACCESS_DENIED and the pending file is removed', async () => {
    interactive = false
    writePendingFile()
    stubNetwork({'/v3/echo': [{body: ECHO}], '/v3/auth/device/token': [{body: {error: 'access_denied'}}]})
    const error = (await runLogin(['--wait', '--json']).catch((e: unknown) => e)) as CliError
    expect([error.exit, error.code]).toEqual([4, 'ACCESS_DENIED'])
    expect(existsSync(pendingPath('hub.example.com'))).toBe(false)
    expect(existsSync(HUB_SESSION())).toBe(false)
  })

  it('--wait with nothing started: exit 2 and the hint says how to start', async () => {
    interactive = false
    stubNetwork({'/v3/echo': [{body: ECHO}]})
    const error = (await runLogin(['--wait']).catch((e: unknown) => e)) as CliError
    expect([error.exit, error.code]).toEqual([2, 'USAGE_ERROR'])
    expect(error.message).toBe('No browser sign-in is waiting for hub.example.com.')
    expect(error.hint).toContain('norbix login --no-browser --json')
  })
})

describe('norbix login --api-key', () => {
  it('saves the key, the project and the host into the named profile — with no network', async () => {
    const hits = stubNetwork({})
    await runLogin(['--api-key', 'nbsu_k1', '--project', 'p9', '--profile', 'ci', '--host', 'https://hub.example.com/'])
    expect(readFileSync(PROFILES_PATH, 'utf8')).toContain('[ci]\nhost = hub.example.com\napi_key = nbsu_k1\nproject_id = p9\n')
    expect(hits).toEqual([])
  })

  it('a localhost host keeps http; NORBIX_HOST works like --host', async () => {
    process.env.NORBIX_HOST = 'localhost:5001'
    await runLogin(['--api-key', 'nbsu_k1', '--project', 'p9', '--profile', 'local'])
    expect(readFileSync(PROFILES_PATH, 'utf8')).toContain('[local]\nhost = localhost:5001\n')
  })

  it('a host replaces the deprecated api_url / hub_url of the profile', async () => {
    writeFileSync(PROFILES_PATH, '[ci]\napi_url = https://api.example.com\nhub_url = https://hub.example.com\n')
    await runLogin(['--api-key', 'nbsu_k1', '--project', 'p9', '--profile', 'ci', '--host', 'cloud.example.com'])
    const ini = readFileSync(PROFILES_PATH, 'utf8')
    expect(ini).toContain('host = cloud.example.com')
    expect(ini).not.toMatch(/api_url|hub_url/)
  })

  it('plain http for a server is refused', async () => {
    const error = (await runLogin(['--api-key', 'k', '--project', 'p', '--host', 'http://hub.example.com']).catch((e: unknown) => e)) as CliError
    expect([error.exit, error.code]).toEqual([2, 'USAGE_ERROR'])
    expect(error.message).toBe('Plain http is only allowed for localhost and *.test names, not for hub.example.com.')
  })
})
