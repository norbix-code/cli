import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {envListAnswer} from '../tests/_env.js'

/**
 * `norbix push device delete` (gateway N48): the Hub's admin route
 * `DELETE /v3/notifications/push/devices/{Id}` — any user's device, in the
 * --env environment. The real command runs through oclif with `fetch` replaced.
 */

const PROJECT = 'test-project'
const API_KEY = 'test-api-key'
const REGION = 'nb-eu-germany'
const DEVICE = 'pnd_7IEb8WjfRcwer3LPwl7fd6'
const globalArgs = ['--project', PROJECT, '--api-key', API_KEY, '--region', REGION]

interface Call {
  method: string
  url: string
  headers: Record<string, string>
}

let calls: Call[]
let realFetch: typeof globalThis.fetch

function fakeFetch(status: number, body: unknown): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const envList = envListAnswer(input, init, ['PROD', 'TEST'])
    if (envList) return envList
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v))
    calls.push({method: init?.method ?? 'GET', url, headers})
    return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
}

const devicesCalls = () => calls.filter((c) => c.url.includes('/notifications/push/devices/'))

beforeEach(() => {
  calls = []
  realFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('norbix push device delete', () => {
  it('calls the hub admin route in the env', async () => {
    fakeFetch(200, {responseStatus: {isSuccess: true, errors: []}})

    const {result, error} = await runCommand<{id: string; deleted: boolean}>([
      'push', 'device', 'delete', DEVICE, '--env', 'TEST', '--yes', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    const call = devicesCalls()[0]!
    expect(call.method).toBe('DELETE')
    expect(new URL(call.url).host).toMatch(/(^|\.)hub\./)
    expect(new URL(call.url).pathname).toBe(`/v3/notifications/push/devices/${DEVICE}`)
    expect(call.headers['norbix-env']).toBe('TEST')
    expect(call.headers['norbix-project-id']).toBe(PROJECT)
    expect(result).toEqual({id: DEVICE, deleted: true})
  })

  it('says why the hub refused', async () => {
    fakeFetch(403, {responseStatus: {isSuccess: false, errors: [
      {errorCode: 'CM-ERRORS-MEMBERSHIP-039', message: "Caller is missing required permission 'push:delete on …:push:device:all'."},
    ]}})

    const {error} = await runCommand(['push', 'device', 'delete', DEVICE, '--yes', ...globalArgs])

    expect(error?.message).toContain('HTTP 403')
    expect(error?.message).toContain('push:delete')
  })

  it('names an old hub on 405', async () => {
    fakeFetch(405, {})

    const {error} = await runCommand(['push', 'device', 'delete', DEVICE, '--yes', ...globalArgs])

    expect(error?.message).toContain('older than the admin device delete')
  })

  it('sends nothing on --dry-run', async () => {
    fakeFetch(200, {})

    const {result, error} = await runCommand<{dryRun: boolean; http: {method: string; url: string; headers: Record<string, string>}}>([
      'push', 'device', 'delete', DEVICE, '--env', 'TEST', '--dry-run', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(result?.dryRun).toBe(true)
    expect(result?.http.method).toBe('DELETE')
    expect(result?.http.url).toContain(`/v3/notifications/push/devices/${DEVICE}`)
    expect(result?.http.headers.Authorization).toBe('Bearer ***')
    expect(devicesCalls()).toHaveLength(0)
  })
})
