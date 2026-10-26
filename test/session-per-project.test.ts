import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {fileURLToPath} from 'node:url'

import {Config} from '@oclif/core'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {BaseCommand, type GlobalFlags, type ResolvedContext} from '../src/base.js'
import Login from '../src/commands/login.js'
import Logout from '../src/commands/logout.js'
import Profiles from '../src/commands/profiles.js'
import Whoami from '../src/commands/whoami.js'
import {HOSTS_DIR} from '../src/lib/hosts.js'
import {NORBIX_DIR, PROFILES_PATH, SESSIONS_DIR, pendingPath, sessionKey, sessionPath} from '../src/lib/profiles.js'
import {seedDefaultHost} from './seed.js'

/**
 * Sessions per Hub AND project: a `norbix login` for project B on a Hub
 * never touches the sign-in for project A on the same Hub, and every
 * command, `logout` and `whoami` use the sign-in of the project they are for.
 * The Hub is mocked (discovery, /echo, the device sign-in); HOME is the test
 * sandbox.
 */

vi.mock('@inquirer/prompts', () => ({input: vi.fn(async () => '')}))
vi.mock('../src/lib/device-login.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/lib/device-login.js')>()
  return {...original, canOpenBrowser: () => false, openBrowser: () => {}}
})

interface Hit {
  method: string
  url: string
  body: unknown
}

/** Fake Hub: answers per `host + path` (or path alone) from a queue, records every call. */
function stubNetwork(routes: Record<string, Array<{status?: number; body: unknown}>>): Hit[] {
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
    return new Response(JSON.stringify(next.body), {status: next.status ?? 200, headers: {'content-type': 'application/json'}})
  })
  return hits
}

const ECHO = {hubUrl: 'https://hub.example.com/v3', apiUrl: 'https://api.example.com/v3', hubVersion: 'v3', apiVersion: 'v3', regions: []}
const START = {deviceCode: 'dc-1', userCode: 'BCDF-GHJK', verificationUri: 'https://cloud.example.com/device', expiresIn: 600, interval: 0}

/** The token the Hub issues for a sign-in asked for `projectId` — a different AI service user per project. */
const token = (projectId: string) => ({
  bearerToken: `access-${projectId}`,
  refreshToken: `refresh-${projectId}`,
  expiresIn: 3600,
  clientId: 'norbix-cli',
  userId: `u-${projectId}`,
  userName: `norbix-cli-${projectId}`,
  displayName: `Norbix CLI (${projectId})`,
  accountId: 'acc-1',
  projectId,
})

/** One browser sign-in on hub.example.com, answered with the token for `projectId`. */
const signInRoutes = (projectId: string) => ({
  '/v3/echo': [{body: ECHO}],
  '/v3/auth/device/start': [{body: START}],
  '/v3/auth/device/token': [{body: token(projectId)}],
})

const HUB = 'hub.example.com'
const file = (projectId?: string) => sessionPath(sessionKey(HUB, projectId))
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
const config = () => Config.load(fileURLToPath(new URL('..', import.meta.url)))

/** A sign-in as a CLI of 1.47 or older stored it: one file per Hub, whatever the project. */
function writeOldStyleSession(projectId: string): void {
  mkdirSync(SESSIONS_DIR, {recursive: true})
  writeFileSync(file(), JSON.stringify({...token(projectId), hubUrl: `https://${HUB}`, hubVersion: 'v3', host: HUB, method: 'browser'}))
}

class Probe extends BaseCommand {
  static discoversHost = false

  async run(): Promise<unknown> {
    return undefined
  }

  async context(flags: GlobalFlags = {}): Promise<ResolvedContext> {
    await this.prepareHost(flags)
    return this.resolveContext(flags)
  }
}

/** The Hub is known: discovery answers for every call of a test. */
const discovered = () => stubNetwork({'/v3/echo': Array.from({length: 8}, () => ({body: ECHO}))})
const probe = async () => new Probe([], await config())
const context = async (flags: GlobalFlags = {}) => (await probe()).context(flags)

let output: string[]

beforeEach(() => {
  output = []
  for (const dir of [SESSIONS_DIR, HOSTS_DIR]) rmSync(dir, {recursive: true, force: true})
  mkdirSync(NORBIX_DIR, {recursive: true})
  seedDefaultHost(homedir())
  writeFileSync(PROFILES_PATH, `[default]\nhost = ${HUB}\nproject_id = p-a\n\n[b]\nhost = ${HUB}\nproject_id = p-b\n`)
  vi.spyOn(BaseCommand.prototype as unknown as {isInteractive: () => boolean}, 'isInteractive').mockImplementation(() => true)
  vi.spyOn(BaseCommand.prototype as unknown as {log: (m?: string) => void}, 'log').mockImplementation((m?: string) => {
    output.push(m ?? '')
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const name of ['NORBIX_HOST', 'NORBIX_PROFILE', 'NORBIX_PROJECT_ID']) delete process.env[name]
})

describe('two sign-ins on one Hub', () => {
  it('a login for project B keeps the sign-in for project A; each profile then uses its own', async () => {
    stubNetwork(signInRoutes('p-a'))
    await Login.run([], await config())
    const hits = stubNetwork(signInRoutes('p-b'))
    await Login.run(['--profile', 'b'], await config())

    // The second sign-in was asked for B — never for the project of the first.
    expect((hits.find((h) => h.url.endsWith('/auth/device/start'))?.body as {projectId: string}).projectId).toBe('p-b')
    expect(output).toContain('Signing in to hub.example.com (profile [b]) for project p-b (from project_id of profile [b]).')

    expect([existsSync(file('p-a')), existsSync(file('p-b')), existsSync(file())]).toEqual([true, true, false])
    expect(readJson(file('p-a')).bearerToken).toBe('access-p-a')
    expect(readJson(file('p-b')).bearerToken).toBe('access-p-b')

    const a = await context()
    const b = await context({profile: 'b'})
    expect([a.authSource, a.bearerToken, a.projectId, a.sessionKey]).toEqual(['session', 'access-p-a', 'p-a', 'hub.example.com@p-a'])
    expect([b.authSource, b.bearerToken, b.projectId, b.sessionKey]).toEqual(['session', 'access-p-b', 'p-b', 'hub.example.com@p-b'])
  })

  it('--project beats the profile: the sign-in is asked and stored for that project, and commands with --project use it', async () => {
    const hits = stubNetwork(signInRoutes('p-c'))
    const result = (await Login.run(['--project', 'p-c'], await config())) as {projectId: string}
    expect((hits.find((h) => h.url.endsWith('/auth/device/start'))?.body as {projectId: string}).projectId).toBe('p-c')
    expect(output).toContain('Signing in to hub.example.com (profile [default]) for project p-c (from --project / NORBIX_PROJECT_ID).')
    expect(result.projectId).toBe('p-c')
    expect([existsSync(file('p-c')), existsSync(file('p-a'))]).toEqual([true, false])

    const withFlag = await context({project: 'p-c'})
    expect([withFlag.authSource, withFlag.bearerToken]).toEqual(['session', 'access-p-c'])
    // The profile's own project (p-a) has no sign-in: the one for p-c is not borrowed.
    const plain = await context()
    expect([plain.authSource, plain.bearerToken, plain.projectId]).toEqual(['none', undefined, 'p-a'])
  })

  it('a stale [default] project never leaks into a login for a profile without one', async () => {
    writeFileSync(PROFILES_PATH, `[default]\nhost = ${HUB}\nproject_id = p-stale\n\n[fresh]\nhost = ${HUB}\n`)
    writeOldStyleSession('p-stale') // and an older sign-in for it, as the previous CLI left it
    const hits = stubNetwork({...signInRoutes('p-new'), '/v3/account/projects': [{body: {list: [{viewId: 'p-new', name: 'New'}]}}]})
    await Login.run(['--profile', 'fresh'], await config())
    const start = hits.find((h) => h.url.endsWith('/auth/device/start'))?.body as {projectId?: string}
    expect(start.projectId).toBeUndefined()
    expect(output).toContain(
      'Signing in to hub.example.com (profile [fresh]) with no project named — pass --project <id> to sign in for one; with one project in the account it is picked by itself.',
    )
    // The Hub pinned the token to the project its roles imply: saved under it; the old sign-in stays.
    expect(readJson(file('p-new')).bearerToken).toBe('access-p-new')
    expect(readJson(file()).bearerToken).toBe('access-p-stale')
  })
})

describe('the sign-in file of CLI 1.47 and older (one per Hub)', () => {
  it('is used for the project it was made for, never for another project — it is not moved or deleted', async () => {
    discovered()
    writeOldStyleSession('p-a')
    const a = await context()
    expect([a.authSource, a.bearerToken, a.sessionKey]).toEqual(['session', 'access-p-a', 'hub.example.com'])
    const b = await context({profile: 'b'})
    expect([b.authSource, b.bearerToken, b.sessionKey]).toEqual(['none', undefined, 'hub.example.com@p-b'])
    expect(existsSync(file())).toBe(true)
  })

  it('made with no project, it is used for any project; a project sign-in is preferred when it exists', async () => {
    mkdirSync(SESSIONS_DIR, {recursive: true})
    discovered()
    writeFileSync(file(), JSON.stringify({...token('p-a'), projectId: undefined, hubUrl: `https://${HUB}`, host: HUB}))
    expect((await context({profile: 'b'})).bearerToken).toBe('access-p-a')
    writeFileSync(file('p-b'), JSON.stringify({...token('p-b'), hubUrl: `https://${HUB}`, host: HUB}))
    expect((await context({profile: 'b'})).bearerToken).toBe('access-p-b')
  })

  it('with no project named anywhere, the Hub only project sign-in is used; with several, the "no project" error lists them', async () => {
    writeFileSync(PROFILES_PATH, `[default]\nhost = ${HUB}\n`)
    mkdirSync(SESSIONS_DIR, {recursive: true})
    discovered()
    writeFileSync(file('p-a'), JSON.stringify({...token('p-a'), hubUrl: `https://${HUB}`, host: HUB}))
    const one = await context()
    expect([one.authSource, one.projectId, one.sessionKey]).toEqual(['session', 'p-a', 'hub.example.com@p-a'])

    writeFileSync(file('p-b'), JSON.stringify({...token('p-b'), hubUrl: `https://${HUB}`, host: HUB}))
    const several = await context()
    expect([several.authSource, several.projectId]).toEqual(['none', undefined])
    class NeedsProject extends Probe {
      async run(): Promise<unknown> {
        return this.client({})
      }
    }

    const stderr: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderr.push(String(chunk))
      return true
    })
    const error = (await NeedsProject.run([], await config()).catch((e: unknown) => e)) as {message: string; oclif?: {exit?: number}}
    expect([error.message, error.oclif?.exit]).toEqual(['No project ID configured.', 2])
    expect(stderr.join('')).toContain('You are signed in to 2 projects on hub.example.com')
    expect(stderr.join('')).toContain('  p-a\n  p-b')
  })
})

describe('norbix logout', () => {
  async function logout(argv: string[]): Promise<unknown> {
    return Logout.run(argv, await config())
  }

  const bothSignedIn = () => {
    mkdirSync(SESSIONS_DIR, {recursive: true})
    writeFileSync(file('p-a'), JSON.stringify({...token('p-a'), hubUrl: `https://${HUB}`, host: HUB}))
    writeFileSync(file('p-b'), JSON.stringify({...token('p-b'), hubUrl: `https://${HUB}`, host: HUB}))
  }

  it('signs out of the active profile project only; the other sign-in stays', async () => {
    bothSignedIn()
    const hits = stubNetwork({'/v3/echo': [{body: ECHO}], '/v3/oauth/revoke': [{body: {}}]})
    const result = (await logout(['--profile', 'b', '--json'])) as {sessions: Array<{hub: string; projectId?: string; revoked: string}>}
    expect(result.sessions).toEqual([{hub: HUB, host: HUB, projectId: 'p-b', revoked: 'revoked'}])
    expect(String(hits.find((h) => h.url.endsWith('/oauth/revoke'))?.body)).toContain('refresh-p-b')
    expect([existsSync(file('p-a')), existsSync(file('p-b'))]).toEqual([true, false])
    expect((await context()).bearerToken).toBe('access-p-a')
  })

  it('--project names the sign-in to remove; without --all nothing else is touched, and a missing one says so', async () => {
    bothSignedIn()
    stubNetwork({'/v3/echo': [{body: ECHO}], '/v3/oauth/revoke': [{body: {}}]})
    await logout(['--project', 'p-a'])
    expect([existsSync(file('p-a')), existsSync(file('p-b'))]).toEqual([false, true])

    const result = (await logout(['--project', 'p-zzz', '--json'])) as {sessions: unknown[]; revoked: string}
    expect(result).toEqual({loggedOut: true, sessions: [], revoked: 'skipped'})
    expect(existsSync(file('p-b'))).toBe(true)
  })

  it('--all removes every sign-in and pending code', async () => {
    bothSignedIn()
    writeFileSync(pendingPath(sessionKey(HUB, 'p-c')), JSON.stringify({deviceCode: 'dc', userCode: 'X', verificationUri: 'u', expiresAt: 'e', interval: 5}))
    stubNetwork({'/v3/oauth/revoke': [{body: {}}, {body: {}}]})
    const result = (await logout(['--all', '--json'])) as {sessions: Array<{projectId?: string}>}
    expect(result.sessions.map((s) => s.projectId)).toEqual(['p-a', 'p-b', 'p-c'])
    expect(existsSync(SESSIONS_DIR) ? readFileSync(PROFILES_PATH, 'utf8') : '').toContain('[default]')
    expect([existsSync(file('p-a')), existsSync(file('p-b')), existsSync(pendingPath(sessionKey(HUB, 'p-c')))]).toEqual([false, false, false])
  })
})

describe('what the sign-ins look like', () => {
  it('profiles lists every sign-in with its Hub, project and file', async () => {
    mkdirSync(SESSIONS_DIR, {recursive: true})
    writeFileSync(file('p-a'), JSON.stringify({...token('p-a'), hubUrl: `https://${HUB}`, host: HUB}))
    writeFileSync(file(), JSON.stringify({...token('p-x'), projectId: undefined, hubUrl: `https://${HUB}`, host: HUB}))
    const result = (await Profiles.run(['--json'], await config())) as {signedIn: Array<Record<string, unknown>>}
    expect(result.signedIn.map((s) => [s.hub, s.projectId, s.file, s.user])).toEqual([
      [HUB, undefined, file(), 'Norbix CLI (p-x)'],
      [HUB, 'p-a', file('p-a'), 'Norbix CLI (p-a)'],
    ])
  })

  it('whoami names the session file of the project it resolved', async () => {
    mkdirSync(SESSIONS_DIR, {recursive: true})
    writeFileSync(file('p-b'), JSON.stringify({...token('p-b'), hubUrl: `https://${HUB}`, host: HUB}))
    discovered()
    const result = (await Whoami.run(['--profile', 'b', '--json'], await config())) as {sessionFile: string; projectId: string; auth: string}
    expect([result.sessionFile, result.projectId, result.auth]).toEqual([file('p-b'), 'p-b', 'session (norbix-cli-p-b)'])
    await Whoami.run(['--profile', 'b'], await config())
    expect(output.join('\n')).toContain(`Session:  ${file('p-b')}`)
  })

  it('the --json shape of login is unchanged', async () => {
    stubNetwork(signInRoutes('p-a'))
    const result = await Login.run(['--json'], await config())
    expect(Object.keys(result as object).sort()).toEqual(
      ['accountId', 'defaultProfile', 'displayName', 'host', 'hub', 'method', 'projectId', 'status', 'userId', 'userName'].sort(),
    )
  })
})
