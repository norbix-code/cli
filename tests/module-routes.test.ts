import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

/**
 * `norbix module enable|disable <name>` for every module, run the way a user
 * types it, through oclif and the real `@norbix.ai/ts` transport, with `fetch`
 * replaced: the verb and the path of the one request it sends. Nothing leaves
 * the process.
 *
 * The gateway moved every module enable / disable from GET to PUT
 * (refactoringV2, 2026-10); `@norbix.ai/ts` 4.10.0 sends PUT. The old GET
 * routes stay on the gateway as hidden, deprecated aliases until 0.2 — the CLI
 * must not depend on them.
 */

interface Call {
  method: string
  path: string
}

let calls: Call[]
let realFetch: typeof globalThis.fetch

beforeEach(() => {
  calls = []
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push({method: init?.method ?? 'GET', path: url.pathname})
    return new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

/** module name → route prefix on the Hub. */
const MODULES: Record<string, string> = {
  code: '/v2/code',
  database: '/v2/database',
  email: '/v2/notifications/email',
  files: '/v2/files',
  logs: '/v2/logs',
  membership: '/v2/membership',
  payments: '/v2/payments',
  push: '/v2/notifications/push',
  scheduler: '/v2/scheduler',
  sms: '/v2/notifications/sms',
}

describe('every module enable / disable sends PUT', () => {
  for (const [name, prefix] of Object.entries(MODULES)) {
    for (const action of ['enable', 'disable'] as const) {
      const argv = ['module', action, name, ...(action === 'disable' ? ['--yes'] : [])]
      it(`${argv.join(' ')} → PUT ${prefix}/${action}`, async () => {
        const {error} = await runCommand([...argv, ...globalArgs])

        expect(error).toBeUndefined()
        expect(calls).toHaveLength(1)
        expect(calls[0]?.method).toBe('PUT')
        expect(calls[0]?.path).toBe(`${prefix}/${action}`)
      })
    }
  }
})
