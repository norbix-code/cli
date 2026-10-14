import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs'
import {homedir, tmpdir} from 'node:os'
import {join} from 'node:path'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import hook from '../src/hooks/init.js'
import {
  CHECK_EVERY_MS,
  REGISTRY_URL,
  cachePath,
  fetchLatest,
  isNewer,
  planUpdateCheck,
  refreshCache,
  updateCheckDisabled,
  writeCache,
} from '../src/lib/update-check.js'

/** N4: a non-blocking, cached "newer CLI" notice that can be turned off. */

const NOW = Date.parse('2026-10-14T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()
const on = {} as NodeJS.ProcessEnv

describe('isNewer', () => {
  it('compares x.y.z numerically, never counts a pre-release as newer', () => {
    expect(isNewer('1.32.0', '1.31.0')).toBe(true)
    expect(isNewer('1.10.0', '1.9.9')).toBe(true)
    expect(isNewer('1.31.0', '1.31.0')).toBe(false)
    expect(isNewer('1.30.9', '1.31.0')).toBe(false)
    expect(isNewer('2.0.0-beta.1', '1.31.0')).toBe(false)
    expect(isNewer(undefined, '1.31.0')).toBe(false)
  })
})

describe('updateCheckDisabled', () => {
  it('NORBIX_NO_UPDATE_CHECK, NO_UPDATE_NOTIFIER and CI turn it off; "0" / "false" do not', () => {
    expect(updateCheckDisabled('1.31.0', {NORBIX_NO_UPDATE_CHECK: '1'})).toBe(true)
    expect(updateCheckDisabled('1.31.0', {NO_UPDATE_NOTIFIER: '1'})).toBe(true)
    expect(updateCheckDisabled('1.31.0', {CI: 'true'})).toBe(true)
    expect(updateCheckDisabled('1.31.0', {NORBIX_NO_UPDATE_CHECK: '0'})).toBe(false)
    expect(updateCheckDisabled('1.31.0', {NORBIX_NO_UPDATE_CHECK: 'false'})).toBe(false)
    expect(updateCheckDisabled('1.31.0', on)).toBe(false)
  })

  it('a development build (0.x, the placeholder before the release stamps a version) never checks', () => {
    expect(updateCheckDisabled('0.1.0', on)).toBe(true)
  })
})

describe('planUpdateCheck', () => {
  it('an empty cache: no notice, refresh', () => {
    const plan = planUpdateCheck({version: '1.31.0', cache: {}, now: NOW, env: on})
    expect(plan.notice).toBeUndefined()
    expect(plan.refresh).toBe(true)
  })

  it('a fresh cache with a newer version: the notice, no refresh; it names the update command and the switch', () => {
    const plan = planUpdateCheck({version: '1.27.0', cache: {checkedAt: hoursAgo(1), latest: '1.31.0'}, now: NOW, env: on})
    expect(plan.refresh).toBe(false)
    expect(plan.notice).toBe(
      'A newer Norbix CLI is available: 1.27.0 → 1.31.0. Update: npm install -g @norbix.ai/cli@latest  (turn this notice off: NORBIX_NO_UPDATE_CHECK=1)',
    )
    expect(plan.cache.notifiedAt).toBe(new Date(NOW).toISOString())
  })

  it('at most once a day — except on login, ai init and whoami', () => {
    const cache = {checkedAt: hoursAgo(1), latest: '1.31.0', notifiedAt: hoursAgo(2)}
    expect(planUpdateCheck({version: '1.27.0', commandId: 'db:find', cache, now: NOW, env: on}).notice).toBeUndefined()
    expect(planUpdateCheck({version: '1.27.0', commandId: 'login', cache, now: NOW, env: on}).notice).toBeDefined()
    expect(planUpdateCheck({version: '1.27.0', commandId: 'ai:init', cache, now: NOW, env: on}).notice).toBeDefined()
    expect(planUpdateCheck({version: '1.27.0', commandId: 'db:find', cache: {...cache, notifiedAt: hoursAgo(25)}, now: NOW, env: on}).notice).toBeDefined()
  })

  it('a stale cache refreshes (and still shows what it knows); up to date shows nothing', () => {
    const stale = planUpdateCheck({version: '1.27.0', cache: {checkedAt: new Date(NOW - CHECK_EVERY_MS - 1).toISOString(), latest: '1.31.0'}, now: NOW, env: on})
    expect(stale).toMatchObject({refresh: true})
    expect(stale.notice).toBeDefined()
    expect(planUpdateCheck({version: '1.31.0', cache: {checkedAt: hoursAgo(1), latest: '1.31.0'}, now: NOW, env: on}).notice).toBeUndefined()
  })

  it('switched off: nothing at all', () => {
    const plan = planUpdateCheck({version: '1.27.0', cache: {checkedAt: hoursAgo(25), latest: '1.31.0'}, now: NOW, env: {NORBIX_NO_UPDATE_CHECK: '1'}})
    expect(plan.notice).toBeUndefined()
    expect(plan.refresh).toBe(false)
  })
})

describe('fetchLatest / refreshCache', () => {
  const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), {status})) as unknown as typeof fetch

  it('reads `version` from the registry document of @norbix.ai/cli', async () => {
    const f = answer({version: '1.32.0'})
    expect(await fetchLatest(f)).toBe('1.32.0')
    expect((f as unknown as {mock: {calls: unknown[][]}}).mock.calls[0][0]).toBe(REGISTRY_URL)
    expect(REGISTRY_URL).toBe('https://registry.npmjs.org/@norbix.ai%2fcli/latest')
  })

  it('a failure, a non-200 or a timeout is undefined, never a throw', async () => {
    expect(await fetchLatest(vi.fn(async () => Promise.reject(new Error('offline'))) as unknown as typeof fetch)).toBeUndefined()
    expect(await fetchLatest(answer({}, 500))).toBeUndefined()
    const slow = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch
    expect(await fetchLatest(slow, 20)).toBeUndefined()
  })

  it('refreshCache writes checkedAt and latest; on a failure only checkedAt (asks again tomorrow)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'norbix-update-'))
    const path = join(dir, 'update-check.json')
    await refreshCache(path, answer({version: '1.32.0'}), NOW)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({checkedAt: new Date(NOW).toISOString(), latest: '1.32.0'})
    await refreshCache(path, answer({}, 500), NOW + 1000)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({checkedAt: new Date(NOW + 1000).toISOString(), latest: '1.32.0'})
    rmSync(dir, {recursive: true, force: true})
  })
})

describe('the init hook', () => {
  let stderr: string[]
  beforeEach(() => {
    stderr = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => (stderr.push(String(chunk)), true))
    delete process.env.NORBIX_NO_UPDATE_CHECK
    delete process.env.CI
  })
  afterEach(() => {
    vi.restoreAllMocks()
    process.env.NORBIX_NO_UPDATE_CHECK = '1'
    rmSync(cachePath(), {force: true})
  })

  const run = (version: string, id = 'whoami') =>
    (hook as unknown as (o: unknown) => Promise<void>).call({}, {argv: [], id, config: {version}})

  it('prints the notice on stderr from a fresh cache, without starting a refresh', async () => {
    expect(cachePath().startsWith(homedir())).toBe(true)
    writeCache({checkedAt: new Date().toISOString(), latest: '9.9.9'})
    await run('1.27.0')
    expect(stderr.join('')).toContain('A newer Norbix CLI is available: 1.27.0 → 9.9.9.')
  })

  it('NORBIX_NO_UPDATE_CHECK=1: no notice, no cache written', async () => {
    process.env.NORBIX_NO_UPDATE_CHECK = '1'
    await run('1.27.0')
    expect(stderr.join('')).toBe('')
    expect(existsSync(cachePath())).toBe(false)
  })

  it('a development build: no notice, no cache written', async () => {
    await run('0.1.0')
    expect(existsSync(cachePath())).toBe(false)
  })
})
