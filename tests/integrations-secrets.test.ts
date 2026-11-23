import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {formatIntegrationSecrets} from '../src/lib/integration-secrets.js'
import {envListAnswer} from './_env.js'

/**
 * `norbix integrations secrets <integrationId>` and `norbix integrations
 * secrets remove <integrationId> <key…>` (gateway docs/tasks/secret-fields.md),
 * run through oclif and the real `@norbix.ai/ts` transport with `fetch`
 * replaced. Nothing leaves the process.
 */

interface Call {
  method: string
  path: string
  query: Record<string, string>
  env: string | null
  body?: unknown
}

const ROWS = {
  result: [
    {key: 'secretKey', field: 'secretKey', isSet: true, isOptional: false},
    {key: 'webhookSigningSecret', field: 'webhookSigningSecret', isSet: false, isOptional: true},
  ],
}

let calls: Call[]
let answer: unknown
let status: number
let printed: string[]
let realFetch: typeof globalThis.fetch

beforeEach(() => {
  calls = []
  answer = ROWS
  status = 200
  printed = []
  vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
    printed.push(parts.join(' '))
  })
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const envList = envListAnswer(input, init)
    if (envList) return envList
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const raw = init?.body
    calls.push({
      method: init?.method ?? 'GET',
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      env: new Headers(init?.headers).get('norbix-env'),
      body: typeof raw === 'string' ? JSON.parse(raw) : raw,
    })
    return new Response(JSON.stringify(answer), {status, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

describe('norbix integrations secrets', () => {
  it('sends GET /v3/integrations/{id}/secrets with the env, prints a table without values', async () => {
    const {error, stdout} = await runCommand(['integrations', 'secrets', 'int_1', '--env', 'TEST', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({method: 'GET', path: '/v3/integrations/int_1/secrets'})
    expect(calls[0]!.env).toBe('TEST')
    const out = stdout + printed.join('\n')
    expect(out).toContain('KEY')
    expect(out).toMatch(/secretKey\s+yes\s+no/)
    expect(out).toMatch(/webhookSigningSecret\s+no\s+yes/)
  })

  it('--json returns the gateway answer as it is', async () => {
    const {error, stdout} = await runCommand(['integrations', 'secrets', 'int_1', '--json', ...globalArgs])

    expect(error).toBeUndefined()
    expect(JSON.parse(stdout || printed.join('\n'))).toEqual(ROWS)
  })

  it('an empty list is one plain sentence, not an empty table', () => {
    expect(formatIntegrationSecrets({result: []})).toMatch(/no saved secrets/)
    expect(formatIntegrationSecrets(undefined)).toMatch(/no saved secrets/)
  })
})

describe('norbix integrations secrets remove', () => {
  it('reaches the remove command (not the list with id "remove") and sends the keys in the body', async () => {
    answer = {id: 'int_1'}

    const {error} = await runCommand([
      'integrations', 'secrets', 'remove', 'int_1', 'webhookSigningSecret', 'eventGridKey', '--yes', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /v3/integrations/int_1/secrets/remove'])
    expect(calls[0]!.body).toMatchObject({keys: ['webhookSigningSecret', 'eventGridKey']})
    expect(printed.join('\n')).toContain('Removed webhookSigningSecret, eventGridKey from int_1.')
  })

  it('asks first: without --yes in a non-interactive shell nothing is sent', async () => {
    const {error} = await runCommand(['integrations', 'secrets', 'remove', 'int_1', 'webhookSigningSecret', ...globalArgs])

    expect(error).toBeDefined()
    expect(error?.message).toMatch(/Confirmation required/)
    expect(calls).toHaveLength(0)
  })

  it('--dry-run sends nothing', async () => {
    const {error} = await runCommand([
      'integrations', 'secrets', 'remove', 'int_1', 'webhookSigningSecret', '--dry-run', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
  })

  it('a needed key: the gateway refusal comes back as the error', async () => {
    status = 400
    answer = {responseStatus: {isSuccess: false, errorCode: 'CM-ERRORS-SECRETS-012', message: 'This secret is needed.'}}

    const {error} = await runCommand(['integrations', 'secrets', 'remove', 'int_1', 'secretKey', '--yes', ...globalArgs])

    expect(error).toBeDefined()
    expect(calls).toHaveLength(1)
  })
})
