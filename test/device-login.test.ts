import {describe, expect, it} from 'vitest'

import {CliError} from '../src/lib/cli-error.js'
import {
  DeviceFlowUnsupportedError,
  browserCommand,
  deviceName,
  pollDeviceToken,
  startDeviceFlow,
  toHttpUrl,
  type DeviceStartResponse,
} from '../src/lib/device-login.js'
import {EXIT} from '../src/lib/exit-codes.js'
import {FALLBACK_HUB_VERSION, resolveHubEndpoint} from '../src/lib/hub-version.js'

/**
 * Opening the login page. The URL comes from the hub's response, so it must
 * never reach a shell: only http(s) is opened, and Windows does not go
 * through `cmd /c start`.
 */
describe('openBrowser', () => {
  it('keeps http and https URLs', () => {
    expect(toHttpUrl('https://hub.norbix.ai/device?code=AB-CD')).toBe('https://hub.norbix.ai/device?code=AB-CD')
    expect(toHttpUrl('http://localhost:5000/device')).toBe('http://localhost:5000/device')
  })

  it('refuses other schemes and non-URLs', () => {
    expect(toHttpUrl('file:///etc/passwd')).toBeUndefined()
    expect(toHttpUrl('javascript:alert(1)')).toBeUndefined()
    expect(toHttpUrl('calc.exe')).toBeUndefined()
    expect(toHttpUrl('')).toBeUndefined()
  })

  it('does not use cmd on Windows, so & and | stay part of the URL', () => {
    const href = toHttpUrl('https://hub.norbix.ai/device?a=1&b=2|calc')!
    const [cmd, args] = browserCommand(href, 'win32')
    expect(cmd).toBe('rundll32')
    expect(args).toEqual(['url.dll,FileProtocolHandler', href])
  })

  it('uses open on macOS and xdg-open elsewhere', () => {
    expect(browserCommand('https://x.test/', 'darwin')).toEqual(['open', ['https://x.test/']])
    expect(browserCommand('https://x.test/', 'linux')).toEqual(['xdg-open', ['https://x.test/']])
  })
})

// ---------- the device flow against the contract (mocked Hub) ----------

const HUB = {base: 'https://hub.test', version: 'v3'}

interface Call {
  url: string
  body: Record<string, unknown>
}

/** A fake Hub: answers from a queue per path and records every call. */
function fakeHub(routes: Record<string, Array<{status?: number; body: unknown}>>) {
  const calls: Call[] = []
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({url, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}})
    const path = Object.keys(routes).find((p) => url.endsWith(p))
    const next = path ? routes[path].shift() : undefined
    if (!next) return new Response('{}', {status: 404})
    return new Response(JSON.stringify(next.body), {status: next.status ?? 200, headers: {'content-type': 'application/json'}})
  }) as typeof fetch
  return {calls, fetchFn}
}

/** A clock that only moves when the code sleeps — no real waiting. */
function fakeClock() {
  let t = 1_000_000
  const sleeps: number[] = []
  return {
    sleeps,
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms)
      t += ms
    },
  }
}

const START: DeviceStartResponse = {
  deviceCode: 'dc',
  userCode: 'BCDF-GHJK',
  verificationUri: 'https://cloud.test/device',
  verificationUriComplete: 'https://cloud.test/device?code=BCDF-GHJK',
  expiresIn: 600,
  interval: 5,
}

const SUCCESS = {
  bearerToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresIn: 3600,
  clientId: 'norbix-cli',
  userId: 'u1',
  userName: 'norbix-cli-mac',
  displayName: 'Norbix CLI (mac)',
  accountId: 'a1',
}

describe('startDeviceFlow', () => {
  it('posts the client name, the device name and the project to {hub}/{version}/auth/device/start', async () => {
    const {calls, fetchFn} = fakeHub({'/v3/auth/device/start': [{body: START}]})
    const start = await startDeviceFlow(HUB, {deviceName: 'mac', projectId: 'p1'}, {fetch: fetchFn})
    expect(start).toEqual(START)
    expect(calls).toEqual([
      {url: 'https://hub.test/v3/auth/device/start', body: {clientName: 'norbix-cli', deviceName: 'mac', projectId: 'p1'}},
    ])
  })

  it('uses the version it is given — never a fixed v2', async () => {
    const {calls, fetchFn} = fakeHub({'/v9/auth/device/start': [{body: START}]})
    await startDeviceFlow({base: 'https://hub.test', version: 'v9'}, {}, {fetch: fetchFn})
    expect(calls[0].url).toBe('https://hub.test/v9/auth/device/start')
    expect(calls.some((c) => c.url.includes('/v2/'))).toBe(false)
  })

  it.each([404, 405, 501])('HTTP %i means a Hub without device sign-in (the login falls back)', async (status) => {
    const {fetchFn} = fakeHub({'/v3/auth/device/start': [{status, body: {}}]})
    await expect(startDeviceFlow(HUB, {}, {fetch: fetchFn})).rejects.toBeInstanceOf(DeviceFlowUnsupportedError)
  })

  it('an unreachable Hub is a network error (exit 7), not a fallback to the password', async () => {
    const fetchFn = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof fetch
    const error = await startDeviceFlow(HUB, {}, {fetch: fetchFn}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CliError)
    expect((error as CliError).exit).toBe(EXIT.NETWORK)
  })
})

describe('pollDeviceToken', () => {
  it('pending → slow_down → success: waits the interval, 5 s more after slow_down, returns the tokens', async () => {
    const clock = fakeClock()
    const {calls, fetchFn} = fakeHub({
      '/v3/auth/device/token': [
        {body: {error: 'authorization_pending'}},
        {body: {error: 'slow_down'}},
        {body: {error: 'authorization_pending'}},
        {body: SUCCESS},
      ],
    })
    const token = await pollDeviceToken(HUB, START, () => {}, {fetch: fetchFn, sleep: clock.sleep, now: clock.now})
    expect(token).toEqual(SUCCESS)
    expect(clock.sleeps).toEqual([5000, 5000, 10_000, 10_000])
    expect(calls.map((c) => c.url)).toEqual(Array.from({length: 4}, () => 'https://hub.test/v3/auth/device/token'))
    expect(calls[0].body).toEqual({deviceCode: 'dc'})
  })

  it('access_denied ends with exit 4 and says to run norbix login again', async () => {
    const clock = fakeClock()
    const {fetchFn} = fakeHub({'/v3/auth/device/token': [{body: {error: 'authorization_pending'}}, {body: {error: 'access_denied'}}]})
    const error = (await pollDeviceToken(HUB, START, () => {}, {fetch: fetchFn, ...clock}).catch((e: unknown) => e)) as CliError
    expect({exit: error.exit, code: error.code, message: error.message, hint: error.hint}).toEqual({
      exit: EXIT.AUTH,
      code: 'ACCESS_DENIED',
      message: 'Sign-in was denied in the browser.',
      hint: 'Run `norbix login` again and choose Allow on the dashboard page.',
    })
  })

  it('expired_token ends with exit 4 and a clear message', async () => {
    const clock = fakeClock()
    const {fetchFn} = fakeHub({'/v3/auth/device/token': [{body: {error: 'expired_token'}}]})
    const error = (await pollDeviceToken(HUB, START, () => {}, {fetch: fetchFn, ...clock}).catch((e: unknown) => e)) as CliError
    expect({exit: error.exit, code: error.code, message: error.message}).toEqual({
      exit: EXIT.AUTH,
      code: 'EXPIRED_TOKEN',
      message: 'The sign-in code expired before it was approved.',
    })
  })

  it('stops by itself when the code lifetime runs out while still pending', async () => {
    const clock = fakeClock()
    const pending = Array.from({length: 10}, () => ({body: {error: 'authorization_pending'}}))
    const {calls, fetchFn} = fakeHub({'/v3/auth/device/token': pending})
    const error = (await pollDeviceToken(HUB, {...START, expiresIn: 20}, () => {}, {fetch: fetchFn, ...clock}).catch(
      (e: unknown) => e,
    )) as CliError
    expect(error.code).toBe('EXPIRED_TOKEN')
    expect(calls.length).toBe(4) // 20 s / 5 s
  })
})

describe('deviceName', () => {
  it('trims the host name and drops .local', () => {
    expect(deviceName('  Domantas-MacBook.local \n')).toBe('Domantas-MacBook')
    expect(deviceName('build-01')).toBe('build-01')
    expect(deviceName('   ')).toBeUndefined()
  })
})

// ---------- the Hub version path ----------

describe('resolveHubEndpoint', () => {
  it('asks the Hub /echo for its version when nothing else says it', async () => {
    const {calls, fetchFn} = fakeHub({'/echo': [{body: {hubVersion: 'v4'}}]})
    expect(await resolveHubEndpoint('https://hub.test/', {fetch: fetchFn})).toEqual({base: 'https://hub.test', version: 'v4'})
    expect(calls.map((c) => c.url)).toEqual([`https://hub.test/${FALLBACK_HUB_VERSION}/echo`])
  })

  it('an explicit version wins, then the stored one, then a version in the URL — no /echo call', async () => {
    const {calls, fetchFn} = fakeHub({})
    expect(await resolveHubEndpoint('https://hub.test', {explicit: 'v5', stored: 'v4', fetch: fetchFn})).toEqual({base: 'https://hub.test', version: 'v5'})
    expect(await resolveHubEndpoint('https://hub.test', {stored: 'v4', fetch: fetchFn})).toEqual({base: 'https://hub.test', version: 'v4'})
    expect(await resolveHubEndpoint('https://hub.test/v3/', {fetch: fetchFn})).toEqual({base: 'https://hub.test', version: 'v3'})
    expect(calls).toEqual([])
  })

  it('falls back to the current Hub version when /echo cannot be read, and ignores a bad version', async () => {
    const {fetchFn} = fakeHub({'/echo': [{body: {hubVersion: '../admin'}}]})
    expect((await resolveHubEndpoint('https://hub.test', {fetch: fetchFn})).version).toBe(FALLBACK_HUB_VERSION)
    expect((await resolveHubEndpoint('https://hub.test', {explicit: 'latest', fetch: fakeHub({}).fetchFn})).version).toBe(FALLBACK_HUB_VERSION)
  })
})
