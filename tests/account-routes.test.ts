import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

/**
 * `account team` (and, later, the other account commands) through oclif and the
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

/** [argv, verb, path] — argv without the leading `account`. */
const routes: Array<[string[], string, string]> = [
  [['team'], 'GET', '/v2/account/collaborators'],
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
