import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

/**
 * `account team`, `account me` and `account me set-phone` through oclif and the
 * real `@norbix.ai/ts` transport: verb, path, query string and body of the one
 * request each sends. `fetch` is replaced, so nothing leaves the process.
 * `account.test.ts` checks the SDK method and fields with a recorder.
 */

interface Call {
  method: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

let calls: Call[]
let realFetch: typeof globalThis.fetch

beforeEach(() => {
  calls = []
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push({
      method: init?.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
    })
    return new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']
const PHONE = '+37060000000'

/** [argv, verb, path] — argv without the leading `account`. */
const routes: Array<[string[], string, string]> = [
  [['team'], 'GET', '/v2/account/collaborators'],
  [['me'], 'GET', '/v2/account/me'],
  [['me', 'set-phone', PHONE], 'PUT', '/v2/account/me/phone'],
  [['me', 'set-phone', '--clear'], 'PUT', '/v2/account/me/phone'],
]

describe('every account command of this round reaches its route', () => {
  for (const [argv, verb, path] of routes) {
    it(`account ${argv.join(' ')} → ${verb} ${path}`, async () => {
      const {error} = await runCommand(['account', ...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe(verb)
      expect(calls[0]?.path).toBe(path)
    })
  }
})

describe('account team — flat paging and filters on the query string', () => {
  it('sends pageSize, startingAfter, endingBefore, projectId and includeAccountOwner as flat query fields', async () => {
    const {error} = await runCommand([
      'account', 'team', '--page-size', '50', '--after', 'acc_usr_20', '--before', 'acc_usr_90',
      '--in-project', 'prj_1', '--include-owner', ...globalArgs,
    ])
    expect(error).toBeUndefined()
    const q = calls[0]!.query
    expect(q.get('pageSize')).toBe('50')
    expect(q.get('startingAfter')).toBe('acc_usr_20')
    expect(q.get('endingBefore')).toBe('acc_usr_90')
    expect(q.get('projectId')).toBe('prj_1')
    expect(q.get('includeAccountOwner')).toBe('true')
    // The nested object is no longer bound by the gateway (14-sms S125).
    expect([...q.keys()].some((k) => k.toLowerCase().startsWith('pagingargs'))).toBe(false)
  })

  it('without flags sends no filter, and the global --project does not narrow the list', async () => {
    await runCommand(['account', 'team', ...globalArgs])
    for (const key of ['pageSize', 'startingAfter', 'endingBefore', 'projectId', 'includeAccountOwner']) {
      expect(calls[0]?.query.has(key)).toBe(false)
    }
  })
})

describe('account me set-phone — the JSON body', () => {
  it('sends the phone', async () => {
    await runCommand(['account', 'me', 'set-phone', PHONE, ...globalArgs])
    expect(calls[0]?.body).toEqual({phone: PHONE})
  })

  it('--clear sends an empty phone, which clears it', async () => {
    await runCommand(['account', 'me', 'set-phone', '--clear', ...globalArgs])
    expect(calls[0]?.body).toEqual({phone: ''})
  })

  it('needs a phone or --clear, and not both — refused before any request', async () => {
    const none = await runCommand(['account', 'me', 'set-phone', ...globalArgs])
    expect(none.error?.message).toMatch(/Pass a phone number/)
    const both = await runCommand(['account', 'me', 'set-phone', PHONE, '--clear', ...globalArgs])
    expect(both.error?.message).toMatch(/not both/)
    expect(calls).toHaveLength(0)
  })

  it('--dry-run sends nothing', async () => {
    const {error} = await runCommand(['account', 'me', 'set-phone', PHONE, '--dry-run', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
  })
})
