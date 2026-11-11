import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {envListAnswer} from './_env.js'

/**
 * `norbix users invite <email> [--role …]`: the Api route
 * `POST /v3/membership/auth/invite` (InviteUserRequest). `--role` is sent as
 * `roles` — repeatable or a comma list; no flag sends no `roles`, so the
 * gateway gives the project's default registration role. `fetch` is replaced,
 * so nothing leaves the process. The dry run's printed body (with `roles`) is
 * checked in agent-mode.test.ts, which reads the real stdout.
 */

interface Call {
  method: string
  host: string
  path: string
  body?: Record<string, unknown>
}

let calls: Call[]
let realFetch: typeof globalThis.fetch

function fakeFetch(status: number, body: unknown): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const envList = envListAnswer(input, init)
    if (envList) return envList
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push({
      method: init?.method ?? 'GET',
      host: url.host,
      path: url.pathname,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
    })
    return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
}

beforeEach(() => {
  calls = []
  realFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']
const EMAIL = 'alice@example.com'
const inviteCalls = () => calls.filter((c) => c.path === '/v3/membership/auth/invite')

describe('norbix users invite', () => {
  it('with no --role sends no roles (the project default registration role)', async () => {
    fakeFetch(200, {})
    const {error} = await runCommand(['users', 'invite', EMAIL, ...globalArgs])

    expect(error).toBeUndefined()
    expect(inviteCalls()).toHaveLength(1)
    const call = inviteCalls()[0]!
    expect(call.method).toBe('POST')
    expect(call.host).toMatch(/(^|\.)api\./)
    expect(call.body?.email).toBe(EMAIL)
    expect(call.body).not.toHaveProperty('roles')
  })

  it('sends repeated and comma-listed --role values as roles, trimmed, in order', async () => {
    fakeFetch(200, {})
    const {error} = await runCommand([
      'users', 'invite', EMAIL, '--role', 'Editor', '--role', 'Viewer, role_66b2f0a1', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(inviteCalls()[0]!.body?.roles).toEqual(['Editor', 'Viewer', 'role_66b2f0a1'])
  })

  it('a dry run sends nothing', async () => {
    fakeFetch(200, {})
    const {error} = await runCommand(['users', 'invite', EMAIL, '--role', 'Editor', '--dry-run', ...globalArgs])

    expect(error).toBeUndefined()
    expect(inviteCalls()).toHaveLength(0)
  })

  it('says why the gateway refused an unknown role', async () => {
    fakeFetch(400, {responseStatus: {isSuccess: false, errors: [
      {errorCode: 'CM-ERRORS-MEMBERSHIP-001', message: "Role 'Ghost' was not found."},
    ]}})
    const {error} = await runCommand(['users', 'invite', EMAIL, '--role', 'Ghost', ...globalArgs])

    expect(inviteCalls()[0]!.body?.roles).toEqual(['Ghost'])
    expect(error).toMatchObject({code: 'CM-ERRORS-MEMBERSHIP-001', status: 400, message: "Role 'Ghost' was not found."})
  })
})
