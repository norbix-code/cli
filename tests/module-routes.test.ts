import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {envListAnswer} from './_env.js'

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
 *
 * Membership and Database are always on (owner, 2026-11-13): the gateway has
 * no enable or disable route for them. `module enable membership|database` is
 * a no-op answered locally (exit 0, like other "nothing to change" answers)
 * and `module disable membership|database` is refused (usage error, exit 2);
 * nothing is sent either way.
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
    const envList = envListAnswer(input, init)
    if (envList) return envList
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
  code: '/v3/code',
  database: '/v3/database',
  email: '/v3/notifications/email',
  files: '/v3/files',
  logs: '/v3/logs',
  membership: '/v3/membership',
  payments: '/v3/payments',
  push: '/v3/notifications/push',
  scheduler: '/v3/scheduler',
  sms: '/v3/notifications/sms',
}

/** Modules with no enable or disable route on the gateway. */
const ALWAYS_ON = new Set(['database', 'membership'])

describe('every module enable / disable sends PUT', () => {
  for (const [name, prefix] of Object.entries(MODULES)) {
    if (ALWAYS_ON.has(name)) continue
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

describe('module enable membership|database is a local no-op', () => {
  // The text line and the exit code, seen from a real process: module-always-on.test.ts.
  for (const name of ALWAYS_ON) {
    for (const extra of [[], ['--dry-run'], ['--json']]) {
      const argv = ['module', 'enable', name, ...extra]
      it(`${argv.join(' ')} → the no-op answer, nothing sent`, async () => {
        const {error, result} = await runCommand([...argv, ...globalArgs])

        expect(error).toBeUndefined()
        expect(result).toEqual({module: name, alwaysOn: true, changed: false})
        expect(calls).toHaveLength(0)
      })
    }
  }

  it('the other modules are still enabled through the gateway', async () => {
    const {error} = await runCommand(['module', 'enable', 'files', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls).toEqual([{method: 'PUT', path: '/v3/files/enable'}])
  })
})

describe('module disable membership|database is refused locally', () => {
  for (const name of ALWAYS_ON) {
    for (const extra of [[], ['--yes'], ['--dry-run']]) {
      const argv = ['module', 'disable', name, ...extra]
      it(`${argv.join(' ')} → usage error, nothing sent`, async () => {
        const {error} = await runCommand([...argv, ...globalArgs])

        expect(error?.message).toBe('Membership and Database are always on; they cannot be disabled.')
        expect((error as {oclif?: {exit?: number}} | undefined)?.oclif?.exit).toBe(2)
        expect(calls).toHaveLength(0)
      })
    }
  }

  it('the other modules can still be disabled', async () => {
    const {error} = await runCommand(['module', 'disable', 'files', '--yes', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls).toEqual([{method: 'PUT', path: '/v3/files/disable'}])
  })
})
