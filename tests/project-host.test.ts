import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {envListAnswer} from './_env.js'

/**
 * On norbix.ai a project's Api calls go to the project's own host
 * (`pr-<32 hex>.api.norbix.ai`) — through oclif and the real `@norbix.ai/ts`
 * transport. `fetch` is replaced, so nothing leaves the process. The label is
 * the server's own value for this project id.
 */

interface Call {
  host: string
  path: string
  headers: Headers
}

const PROJECT = 'pr_5XvmrTA6JVggZdmEE5bGdm'
const PROJECT_API = 'pr-022c4aca9f9e4df787ab0a20c83c44b6.api.norbix.ai'

let calls: Call[]
let realFetch: typeof globalThis.fetch

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  calls = []
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const envList = envListAnswer(input, init)
    if (envList) return envList
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push({host: url.host, path: url.pathname, headers: new Headers(init?.headers)})
    return new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = realFetch
})

describe('project host — norbix.ai', () => {
  it('an Api command calls the project host, with the project header and the region header', async () => {
    const {error} = await runCommand(['users', 'list', '--project', PROJECT, '--api-key', 'k', '--region', 'nb-eu-germany'])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect([calls[0]?.host, calls[0]?.path]).toEqual([PROJECT_API, '/v3/membership/auth'])
    expect(calls[0]?.headers.get('norbix-project-id')).toBe(PROJECT)
    expect(calls[0]?.headers.get('nb-region')).toBe('nb-eu-germany')
  })

  it('a Hub command of the same project stays on the regional Hub host', async () => {
    const {error} = await runCommand(['users', 'contacts', 'list', '--project', PROJECT, '--api-key', 'k', '--region', 'nb-eu-germany'])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.host).toBe('nb-eu-germany.hub.norbix.ai')
    expect(calls[0]?.headers.get('norbix-project-id')).toBe(PROJECT)
  })

  it('an id that is not a Norbix project id keeps the regional Api host', async () => {
    const {error} = await runCommand(['users', 'list', '--project', 'test-project', '--api-key', 'k', '--region', 'nb-eu-germany'])

    expect(error).toBeUndefined()
    expect(calls[0]?.host).toBe('nb-eu-germany.api.norbix.ai')
  })
})
