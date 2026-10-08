import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

import {Config} from '@oclif/core'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {BaseCommand, type GlobalFlags, type ResolvedContext} from '../src/base.js'
import Logout from '../src/commands/logout.js'
import {CliError} from '../src/lib/cli-error.js'
import {
  HOSTS_DIR,
  storedHost,
  cachedProjectRegion,
  discover,
  hostCachePath,
  normalizeHost,
  resolveHost,
} from '../src/lib/hosts.js'
import {
  LEGACY_SESSION_PATH,
  NORBIX_DIR,
  PROFILES_PATH,
  SESSIONS_DIR,
  readSession,
  sessionPath,
} from '../src/lib/profiles.js'
import {ownerOnly, seedDefaultHost} from './seed.js'

/**
 * Hosts: the CLI is given one host and asks it where its Hub is
 * (/.well-known/norbix.json, else the host is the Hub), then asks the Hub
 * for everything else (/echo). Answers are cached per Hub; sign-ins are
 * stored per Hub; credentials follow --api-key → profile api_key → the
 * host's sign-in.
 */

type Answer = {status?: number; body: unknown}

/** Fake hosts by `host + path`; anything else 404. Records every URL. */
function fakeFetch(routes: Record<string, Answer | Answer[]>): {fetch: typeof fetch; urls: string[]} {
  const urls: string[] = []
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    urls.push(`${init?.method ?? 'GET'} ${url}`)
    const u = new URL(url)
    const route = routes[`${u.host}${u.pathname}`]
    const answer = Array.isArray(route) ? route.shift() : route
    if (!answer) return new Response('{}', {status: 404})
    if (answer.status === 0) throw new TypeError('fetch failed')
    const text = typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body)
    return new Response(text, {status: answer.status ?? 200})
  }) as typeof fetch
  return {fetch: fn, urls}
}

const FINLO_ECHO = {
  hubUrl: 'https://hub.finlo.space/v3',
  apiUrl: 'https://api.finlo.space/v3',
  hubVersion: 'v3',
  apiVersion: 'v3',
  regions: [
    {code: 'nb-eu-germany', displayName: 'EU — Germany', apiUrl: 'https://nb-eu-germany.api.finlo.space', hubUrl: 'https://nb-eu-germany.hub.finlo.space'},
  ],
  agent: {
    deviceAuthorizationUrl: 'https://hub.finlo.space/v3/auth/device/start',
    deviceTokenUrl: 'https://hub.finlo.space/v3/auth/device/token',
  },
}

beforeEach(() => {
  for (const dir of [SESSIONS_DIR, HOSTS_DIR]) rmSync(dir, {recursive: true, force: true})
  rmSync(LEGACY_SESSION_PATH, {force: true})
  mkdirSync(NORBIX_DIR, {recursive: true})
  writeFileSync(PROFILES_PATH, '')
  seedDefaultHost(homedir())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const name of ['NORBIX_HUB_URL', 'NORBIX_API_URL', 'NORBIX_HUB_VERSION', 'NORBIX_HOST']) delete process.env[name]
})

describe('normalizeHost', () => {
  it('https by default, http only for localhost and *.test names, path and slash dropped', () => {
    expect(normalizeHost('dcli.norbix.test:5001')).toBe('http://dcli.norbix.test:5001')
    expect(normalizeHost('http://cloud.dcli.norbix.test')).toBe('http://cloud.dcli.norbix.test')
    expect(normalizeHost('cloud.finlo.space')).toBe('https://cloud.finlo.space')
    expect(normalizeHost('https://hub.finlo.space/v3/')).toBe('https://hub.finlo.space')
    expect(normalizeHost('localhost:5001')).toBe('http://localhost:5001')
    expect(normalizeHost('127.0.0.1:5001')).toBe('http://127.0.0.1:5001')
    expect(normalizeHost('https://localhost:8443')).toBe('https://localhost:8443')
  })

  it('a stored host drops the scheme only when it is the default one', () => {
    expect(storedHost('https://cloud.finlo.space/')).toBe('cloud.finlo.space')
    expect(storedHost('http://localhost:5001')).toBe('localhost:5001')
    expect(storedHost('http://dcli.norbix.test:5001')).toBe('dcli.norbix.test:5001')
    expect(storedHost('https://localhost:8443')).toBe('https://localhost:8443')
  })

  it('refuses plain http for a server, other schemes and empty input (exit 2)', () => {
    for (const bad of ['http://hub.finlo.space', 'http://hub.test.example.com', 'ftp://hub.finlo.space', '  ']) {
      const error = (() => {
        try {
          normalizeHost(bad)
        } catch (e) {
          return e
        }
      })() as CliError
      expect(error).toBeInstanceOf(CliError)
      expect(error.exit).toBe(2)
    }
  })
})

describe('discover', () => {
  it('the well-known file names the Hub; /echo gives the rest — regional URLs stay without a version', async () => {
    const {fetch, urls} = fakeFetch({
      'cloud.finlo.space/.well-known/norbix.json': {body: {hubUrl: 'https://hub.finlo.space/v3'}},
      'hub.finlo.space/v3/echo': {body: FINLO_ECHO},
    })
    const info = await discover('https://cloud.finlo.space', {fetch, now: () => Date.parse('2026-10-08T10:00:00Z')})
    expect(urls).toEqual(['GET https://cloud.finlo.space/.well-known/norbix.json', 'GET https://hub.finlo.space/v3/echo'])
    expect(info).toEqual({
      hubUrl: 'https://hub.finlo.space/v3',
      apiUrl: 'https://api.finlo.space/v3',
      hubVersion: 'v3',
      apiVersion: 'v3',
      regions: [{code: 'nb-eu-germany', apiUrl: 'https://nb-eu-germany.api.finlo.space', hubUrl: 'https://nb-eu-germany.hub.finlo.space'}],
      deviceAuthorizationUrl: 'https://hub.finlo.space/v3/auth/device/start',
      deviceTokenUrl: 'https://hub.finlo.space/v3/auth/device/token',
      fetchedAt: '2026-10-08T10:00:00.000Z',
      source: 'discovered',
    })
  })

  it('404 on the well-known file: the host itself is the Hub', async () => {
    const {fetch, urls} = fakeFetch({'hub.finlo.space/v3/echo': {body: FINLO_ECHO}})
    const info = await discover('https://hub.finlo.space', {fetch})
    expect(urls).toEqual(['GET https://hub.finlo.space/.well-known/norbix.json', 'GET https://hub.finlo.space/v3/echo'])
    expect(info.apiUrl).toBe('https://api.finlo.space/v3')
  })

  it('a dashboard page instead of JSON (bad JSON) or JSON without hubUrl: the host is treated as the Hub', async () => {
    for (const body of ['<!doctype html><html>dashboard</html>', {other: 1}]) {
      const {fetch, urls} = fakeFetch({
        'hub.finlo.space/.well-known/norbix.json': {body},
        'hub.finlo.space/v3/echo': {body: FINLO_ECHO},
      })
      expect((await discover('https://hub.finlo.space', {fetch})).hubUrl).toBe('https://hub.finlo.space/v3')
      expect(urls[1]).toBe('GET https://hub.finlo.space/v3/echo')
    }
  })

  it('a plain-http hubUrl for a server is not followed', async () => {
    const {fetch, urls} = fakeFetch({
      'cloud.finlo.space/.well-known/norbix.json': {body: {hubUrl: 'http://evil.example.com/v3'}},
      'cloud.finlo.space/v3/echo': {body: {...FINLO_ECHO, hubUrl: 'https://cloud.finlo.space/v3'}},
    })
    await discover('https://cloud.finlo.space', {fetch})
    expect(urls).toEqual(['GET https://cloud.finlo.space/.well-known/norbix.json', 'GET https://cloud.finlo.space/v3/echo'])
  })

  it('local development: localhost:5001 over http, /echo names the real local ports', async () => {
    const {fetch} = fakeFetch({
      'localhost:5001/v3/echo': {body: {hubUrl: 'http://localhost:5001/v3', apiUrl: 'http://localhost:5002/v3', hubVersion: 'v3', apiVersion: 'v3'}},
    })
    const info = await discover(normalizeHost('localhost:5001'), {fetch})
    expect([info.hubUrl, info.apiUrl]).toEqual(['http://localhost:5001/v3', 'http://localhost:5002/v3'])
  })

  it('a local Norbix stack (*.test over http): the http Hub and Api /echo names are kept', async () => {
    const {fetch, urls} = fakeFetch({
      'dcli.norbix.test:5001/v3/echo': {
        body: {hubUrl: 'http://dcli.norbix.test:5001/v3', apiUrl: 'http://dcli.norbix.test:5002/v3', hubVersion: 'v3', apiVersion: 'v3'},
      },
    })
    const info = await discover(normalizeHost('dcli.norbix.test:5001'), {fetch})
    expect(urls[0]).toBe('GET http://dcli.norbix.test:5001/.well-known/norbix.json')
    expect([info.hubUrl, info.apiUrl]).toEqual(['http://dcli.norbix.test:5001/v3', 'http://dcli.norbix.test:5002/v3'])
  })

  it('a host that is no Hub: exit 2 NOT_A_HUB; a host that cannot be reached: exit 7', async () => {
    const notHub = (await discover('https://example.com', fakeFetch({})).catch((e: unknown) => e)) as CliError
    expect([notHub.exit, notHub.code]).toEqual([2, 'NOT_A_HUB'])
    const oldDashboard = (await discover('https://cloud.finlo.space', fakeFetch({})).catch((e: unknown) => e)) as CliError
    expect(oldDashboard.hint).toBe('If cloud.finlo.space is your Norbix dashboard, its installation may be older than discovery: pass the Hub instead, e.g. --host hub.finlo.space.')
    const offline = (await discover('https://down.example.com', fakeFetch({'down.example.com/.well-known/norbix.json': {status: 0, body: ''}})).catch(
      (e: unknown) => e,
    )) as CliError
    expect([offline.exit, offline.code]).toEqual([7, 'NORBIX_NETWORK_ERROR'])
  })
})

describe('host cache (~/.norbix/hosts)', () => {
  const routes = () => ({
    'cloud.finlo.space/.well-known/norbix.json': [{body: {hubUrl: 'https://hub.finlo.space/v3'}}],
    'hub.finlo.space/v3/echo': [{body: FINLO_ECHO}, {body: FINLO_ECHO}],
    'hub.finlo.space/.well-known/norbix.json': [{status: 404, body: {}}],
  })

  it('caches per Hub (mode 600): cloud.x and hub.x share one file, and a fresh answer sends nothing', async () => {
    const net = fakeFetch(routes())
    const a = await resolveHost('https://cloud.finlo.space', {fetch: net.fetch})
    const b = await resolveHost('https://hub.finlo.space', {fetch: net.fetch})
    // hub.x is the Hub itself: its cache file is already there.
    expect([a.hubKey, a.from, b.hubKey, b.from]).toEqual(['hub.finlo.space', 'network', 'hub.finlo.space', 'cache'])
    expect(ownerOnly(hostCachePath('hub.finlo.space'))).toBe(true)

    const before = net.urls.length
    const again = await resolveHost('https://cloud.finlo.space', {fetch: net.fetch})
    expect([again.from, again.info.apiUrl]).toEqual(['cache', 'https://api.finlo.space/v3'])
    expect(net.urls.length).toBe(before)
  })

  it('after 24 h the answer is fetched again', async () => {
    const t0 = Date.parse('2026-10-08T10:00:00Z')
    const net = fakeFetch(routes())
    await resolveHost('https://cloud.finlo.space', {fetch: net.fetch, now: () => t0})
    expect((await resolveHost('https://cloud.finlo.space', {fetch: net.fetch, now: () => t0 + 23 * 3600_000})).from).toBe('cache')
    const net2 = fakeFetch(routes())
    const later = await resolveHost('https://cloud.finlo.space', {fetch: net2.fetch, now: () => t0 + 25 * 3600_000})
    expect(later.from).toBe('network')
    expect(net2.urls[0]).toBe('GET https://cloud.finlo.space/.well-known/norbix.json')
  })

  it('offline: an old answer is used; for hub.norbix.ai with nothing cached, the built-in addresses', async () => {
    const t0 = Date.parse('2026-10-08T10:00:00Z')
    await resolveHost('https://cloud.finlo.space', {fetch: fakeFetch(routes()).fetch, now: () => t0})
    const down = fakeFetch({'cloud.finlo.space/.well-known/norbix.json': {status: 0, body: ''}, 'hub.norbix.ai/.well-known/norbix.json': {status: 0, body: ''}})
    const stale = await resolveHost('https://cloud.finlo.space', {fetch: down.fetch, now: () => t0 + 48 * 3600_000})
    expect([stale.from, stale.info.hubUrl]).toEqual(['stale cache', 'https://hub.finlo.space/v3'])

    rmSync(HOSTS_DIR, {recursive: true, force: true})
    const builtIn = await resolveHost('https://hub.norbix.ai', {fetch: down.fetch})
    expect([builtIn.from, builtIn.info.hubUrl, builtIn.info.apiUrl]).toEqual(['built-in', 'https://hub.norbix.ai', 'https://api.norbix.ai'])
  })
})

/** A command that only shows its resolved context. */
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

async function probe(): Promise<Probe> {
  return new Probe([], await Config.load(fileURLToPath(new URL('..', import.meta.url))))
}

/** Discovery for hub.finlo.space and cloud.finlo.space through the global fetch. */
function stubFinlo(extra: Record<string, Answer | Answer[]> = {}): string[] {
  const net = fakeFetch({
    'cloud.finlo.space/.well-known/norbix.json': {body: {hubUrl: 'https://hub.finlo.space/v3'}},
    'hub.finlo.space/v3/echo': {body: FINLO_ECHO},
    ...extra,
  })
  vi.stubGlobal('fetch', net.fetch)
  return net.urls
}

function signIn(hubKey: string, over: Record<string, unknown> = {}): void {
  mkdirSync(SESSIONS_DIR, {recursive: true})
  writeFileSync(
    sessionPath(hubKey),
    JSON.stringify({bearerToken: `token-${hubKey}`, refreshToken: `refresh-${hubKey}`, clientId: 'norbix-cli', hubUrl: `https://${hubKey}`, hubVersion: 'v3', ...over}),
  )
}

describe('context: host → Hub and Api', () => {
  it('a profile host is discovered; calls use the Hub and Api /echo names, with their version', async () => {
    writeFileSync(PROFILES_PATH, '[finlo]\nhost = cloud.finlo.space\nproject_id = p1\n')
    stubFinlo()
    const ctx = await (await probe()).context({profile: 'finlo'})
    expect([ctx.host, ctx.hostSource, ctx.hubKey]).toEqual(['https://cloud.finlo.space', 'profile [finlo]', 'hub.finlo.space'])
    expect([ctx.hubUrl, ctx.hubVersion, ctx.apiUrl, ctx.apiVersion]).toEqual(['https://hub.finlo.space', 'v3', 'https://api.finlo.space', 'v3'])
    expect(ctx.usesDefaultEndpoints).toBe(false)
  })

  it('a region the Hub lists: its own addresses, with the Hub version appended by the SDK', async () => {
    stubFinlo()
    const ctx = await (await probe()).context({host: 'hub.finlo.space', region: 'nb-eu-germany'})
    expect([ctx.apiUrl, ctx.hubUrl, ctx.apiVersion]).toEqual([
      'https://nb-eu-germany.api.finlo.space',
      'https://nb-eu-germany.hub.finlo.space',
      'v3',
    ])
    expect(ctx.authHubUrl).toBe('https://hub.finlo.space')
  })

  it('no host anywhere: hub.norbix.ai, region subdomains as before', async () => {
    const ctx = await (await probe()).context({region: 'nb-eu-germany'})
    expect([ctx.host, ctx.hostSource]).toEqual(['https://hub.norbix.ai', 'default'])
    expect([ctx.apiUrl, ctx.hubUrl]).toEqual(['https://nb-eu-germany.api.norbix.ai', 'https://nb-eu-germany.hub.norbix.ai'])
    expect(ctx.usesDefaultEndpoints).toBe(true)
  })

  it('deprecated hub_url / api_url and NORBIX_HUB_URL still work for one release, with one warning each', async () => {
    writeFileSync(PROFILES_PATH, '[default]\nproject_id = p1\nhub_url = https://hub.finlo.space/v3\napi_url = https://api.finlo.space\n')
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const p = await probe()
    const ctx = await p.context()
    expect([ctx.hubUrl, ctx.hubVersion, ctx.apiUrl, ctx.hostSource, ctx.hubKey]).toEqual([
      'https://hub.finlo.space',
      'v3',
      'https://api.finlo.space',
      'deprecated url',
      'hub.finlo.space',
    ])
    await p.context()
    const warnings = stderr.mock.calls.map((c) => String(c[0]))
    expect(warnings).toEqual([
      'Warning: api_url / hub_url in profile [default] is deprecated and will stop working in the next release. ' +
        'Use the host instead: `host = hub.finlo.space` in the profile (norbix config set host hub.finlo.space), --host or NORBIX_HOST.\n',
    ])

    process.env.NORBIX_HUB_URL = 'https://hub.other.test/v4'
    process.env.NORBIX_HUB_VERSION = 'v5'
    const env = await p.context()
    expect([env.hubUrl, env.hubVersion]).toEqual(['https://hub.other.test', 'v5'])
  })

  it('a profile host wins over the deprecated variables', async () => {
    writeFileSync(PROFILES_PATH, '[default]\nhost = hub.finlo.space\n')
    process.env.NORBIX_HUB_URL = 'https://hub.other.test'
    stubFinlo()
    const ctx = await (await probe()).context()
    expect(ctx.hubUrl).toBe('https://hub.finlo.space')
    expect(ctx.deprecations).toEqual([])
  })
})

describe('context: credential order', () => {
  it('--api-key beats the profile key, the profile key beats the sign-in', async () => {
    writeFileSync(PROFILES_PATH, '[finlo-ci]\nhost = hub.finlo.space\napi_key = nbsu_profile\nproject_id = p1\n')
    signIn('hub.finlo.space')
    stubFinlo()
    const p = await probe()
    const flag = await p.context({profile: 'finlo-ci', 'api-key': 'nbsu_flag'})
    expect([flag.authSource, flag.apiKey, flag.bearerToken]).toEqual(['flag/env api key', 'nbsu_flag', undefined])
    const prof = await p.context({profile: 'finlo-ci'})
    expect([prof.authSource, prof.apiKey, prof.bearerToken]).toEqual(['profile [finlo-ci]', 'nbsu_profile', undefined])
  })

  it('a profile WITHOUT an api_key uses the sign-in of its host — even with an explicit --profile', async () => {
    writeFileSync(PROFILES_PATH, '[finlo]\nhost = cloud.finlo.space\nproject_id = p1\n')
    signIn('hub.finlo.space', {projectId: 'p-session', userName: 'norbix-cli-mac'})
    signIn('hub.norbix.ai')
    stubFinlo()
    const ctx = await (await probe()).context({profile: 'finlo'})
    expect([ctx.authSource, ctx.bearerToken, ctx.projectId, ctx.userName]).toEqual(['session', 'token-hub.finlo.space', 'p1', 'norbix-cli-mac'])
  })

  it('--host for another Hub: the [default] profile and its key are left out — never sent to another host', async () => {
    writeFileSync(PROFILES_PATH, '[default]\napi_key = nbsu_norbix\nproject_id = p-norbix\n')
    signIn('hub.finlo.space')
    stubFinlo()
    const ctx = await (await probe()).context({host: 'hub.finlo.space'})
    expect([ctx.profileName, ctx.apiKey, ctx.authSource, ctx.bearerToken, ctx.projectId]).toEqual([
      undefined,
      undefined,
      'session',
      'token-hub.finlo.space',
      undefined,
    ])
  })

  it('an explicit --profile for another host than --host is a usage error', async () => {
    writeFileSync(PROFILES_PATH, '[finlo]\nhost = hub.finlo.space\n')
    stubFinlo({'other.example.com/v3/echo': {body: {...FINLO_ECHO, hubUrl: 'https://other.example.com/v3'}}})
    const error = (await (await probe()).context({profile: 'finlo', host: 'other.example.com'}).catch((e: unknown) => e)) as CliError
    expect([error.exit, error.message]).toEqual([2, 'Profile "finlo" is for hub.finlo.space, but --host / NORBIX_HOST names other.example.com.'])
  })
})

describe('context: a project tells its region', () => {
  it('on norbix.ai with no region, the project primary region is asked once and cached', async () => {
    rmSync(HOSTS_DIR, {recursive: true, force: true})
    const net = fakeFetch({
      'hub.norbix.ai/v3/echo': {body: {hubUrl: 'https://hub.norbix.ai/v3', apiUrl: 'https://api.norbix.ai/v3', hubVersion: 'v3', apiVersion: 'v3'}},
      'hub.norbix.ai/v3/account/projects/p1': [{body: {item: {primaryRegion: {id: 'nb-eu-germany', name: 'Germany'}}}}],
    })
    vi.stubGlobal('fetch', net.fetch)
    const p = await probe()
    const ctx = await p.context({project: 'p1', 'api-key': 'nbsu_k'})
    expect([ctx.region, ctx.apiUrl]).toEqual(['nb-eu-germany', 'https://nb-eu-germany.api.norbix.ai'])
    expect(net.urls.at(-1)).toBe('GET https://hub.norbix.ai/v3/account/projects/p1')
    expect(cachedProjectRegion('hub.norbix.ai', 'p1')).toBe('nb-eu-germany')

    const before = net.urls.length
    expect((await p.context({project: 'p1', 'api-key': 'nbsu_k'})).region).toBe('nb-eu-germany')
    expect(net.urls.length).toBe(before)
  })

  it('a Hub that refuses (no permission): no region, the old rule asks for --region', async () => {
    rmSync(HOSTS_DIR, {recursive: true, force: true})
    vi.stubGlobal(
      'fetch',
      fakeFetch({
        'hub.norbix.ai/v3/echo': {body: {hubUrl: 'https://hub.norbix.ai/v3', apiUrl: 'https://api.norbix.ai/v3', hubVersion: 'v3'}},
        'hub.norbix.ai/v3/account/projects/p1': {status: 403, body: {}},
      }).fetch,
    )
    const ctx = await (await probe()).context({project: 'p1', 'api-key': 'nbsu_k'})
    expect([ctx.region, ctx.usesDefaultEndpoints]).toEqual([undefined, true])
  })
})

describe('sessions per Hub', () => {
  it('the old ~/.norbix/session.json moves to sessions/<its hub>.json on first read', () => {
    writeFileSync(LEGACY_SESSION_PATH, JSON.stringify({bearerToken: 'a', refreshToken: 'r', clientId: 'norbix-cli', hubUrl: 'https://hub.finlo.space'}))
    expect(readSession('hub.finlo.space')).toMatchObject({bearerToken: 'a', hubUrl: 'https://hub.finlo.space'})
    expect(existsSync(LEGACY_SESSION_PATH)).toBe(false)
    expect(ownerOnly(sessionPath('hub.finlo.space'))).toBe(true)
  })

  it('a migrated sign-in that stored no Hub was made on norbix.ai', () => {
    writeFileSync(LEGACY_SESSION_PATH, JSON.stringify({bearerToken: 'a'}))
    expect(readSession('hub.norbix.ai')).toMatchObject({bearerToken: 'a', hubUrl: 'https://hub.norbix.ai'})
  })

  it('migration never overwrites a newer sign-in of the same Hub', () => {
    signIn('hub.norbix.ai')
    writeFileSync(LEGACY_SESSION_PATH, JSON.stringify({bearerToken: 'old'}))
    expect(readSession('hub.norbix.ai')?.bearerToken).toBe('token-hub.norbix.ai')
    expect(existsSync(LEGACY_SESSION_PATH)).toBe(false)
  })
})

describe('norbix logout', () => {
  async function runLogout(argv: string[]): Promise<unknown> {
    vi.spyOn(BaseCommand.prototype as unknown as {log: (m?: string) => void}, 'log').mockImplementation(() => {})
    return Logout.run(argv, await Config.load(fileURLToPath(new URL('..', import.meta.url))))
  }

  it('without flags revokes and removes every host sign-in; profiles stay', async () => {
    writeFileSync(PROFILES_PATH, '[ci]\nhost = hub.finlo.space\napi_key = nbsu_k\n')
    signIn('hub.finlo.space')
    signIn('hub.norbix.ai')
    const urls = stubFinlo({'hub.finlo.space/v3/oauth/revoke': {body: {}}, 'hub.norbix.ai/v3/oauth/revoke': {body: {}}})
    const result = (await runLogout(['--json'])) as {sessions: Array<{hub: string; revoked: string}>}
    expect(result.sessions).toEqual([
      {hub: 'hub.finlo.space', revoked: 'revoked'},
      {hub: 'hub.norbix.ai', revoked: 'revoked'},
    ])
    expect(urls.filter((u) => u.includes('/oauth/revoke'))).toEqual([
      'POST https://hub.finlo.space/v3/oauth/revoke',
      'POST https://hub.norbix.ai/v3/oauth/revoke',
    ])
    expect([existsSync(sessionPath('hub.finlo.space')), existsSync(sessionPath('hub.norbix.ai'))]).toEqual([false, false])
    expect(readFileSync(PROFILES_PATH, 'utf8')).toContain('api_key = nbsu_k')
  })

  it('--host (cloud host of a Hub) removes only that Hub sign-in', async () => {
    signIn('hub.finlo.space')
    signIn('hub.norbix.ai')
    const urls = stubFinlo({'hub.finlo.space/v3/oauth/revoke': {body: {}}})
    await runLogout(['--host', 'cloud.finlo.space'])
    expect(urls.filter((u) => u.includes('/oauth/revoke'))).toEqual(['POST https://hub.finlo.space/v3/oauth/revoke'])
    expect([existsSync(sessionPath('hub.finlo.space')), existsSync(sessionPath('hub.norbix.ai'))]).toEqual([false, true])
  })

  it('--profile removes only the sign-in of that profile host; the profile stays', async () => {
    writeFileSync(PROFILES_PATH, '[finlo]\nhost = hub.finlo.space\nproject_id = p1\n')
    signIn('hub.finlo.space')
    signIn('hub.norbix.ai')
    stubFinlo({'hub.finlo.space/v3/oauth/revoke': {body: {}}})
    await runLogout(['--profile', 'finlo'])
    expect([existsSync(sessionPath('hub.finlo.space')), existsSync(sessionPath('hub.norbix.ai'))]).toEqual([false, true])
    expect(readFileSync(PROFILES_PATH, 'utf8')).toContain('[finlo]\nhost = hub.finlo.space')
  })

  it('a token refresh writes back to the session file of its own Hub', async () => {
    writeFileSync(PROFILES_PATH, '[finlo]\nhost = hub.finlo.space\nproject_id = p1\n')
    signIn('hub.finlo.space', {expiresAt: new Date(Date.now() - 1000).toISOString()})
    signIn('hub.norbix.ai')
    stubFinlo({
      'hub.finlo.space/v3/oauth/token': {body: {access_token: 'fresh', refresh_token: 'refresh-2', expires_in: 3600}},
    })
    class Refresh extends Probe {
      async token(): Promise<string | undefined> {
        await this.prepareHost({profile: 'finlo'})
        return this.freshContext({profile: 'finlo'}).then((c) => c.bearerToken)
      }
    }

    const r = new Refresh([], await Config.load(fileURLToPath(new URL('..', import.meta.url))))
    expect(await r.token()).toBe('fresh')
    expect(readSession('hub.finlo.space')).toMatchObject({bearerToken: 'fresh', refreshToken: 'refresh-2'})
    expect(readSession('hub.norbix.ai')?.bearerToken).toBe('token-hub.norbix.ai')
  })
})

describe('the files on disk', () => {
  it('discovery writes only the hosts folder; no token ever lands there', async () => {
    stubFinlo()
    signIn('hub.finlo.space')
    await (await probe()).context({host: 'cloud.finlo.space'})
    const text = readFileSync(join(HOSTS_DIR, 'hub.finlo.space.json'), 'utf8') + readFileSync(join(HOSTS_DIR, 'aliases.json'), 'utf8')
    expect(text).not.toMatch(/token-|refresh-/)
    expect(JSON.parse(readFileSync(join(HOSTS_DIR, 'aliases.json'), 'utf8'))['cloud.finlo.space'].hub).toBe('hub.finlo.space')
  })
})
