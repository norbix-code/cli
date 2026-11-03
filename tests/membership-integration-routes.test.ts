import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {envListAnswer} from './_env.js'

/**
 * One row per membership integration endpoint: run the command the way a user
 * types it, through oclif and the real `@norbix.ai/ts` transport, and check
 * the verb and path of the request it sends — then the body of the commands
 * that build one. `fetch` is replaced, so nothing leaves the process and no
 * provider is contacted. A wrong route token (`{Id}` vs `{id}`) fails here.
 */

const ID = '66b2f0a1'

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
    const envList = envListAnswer(input, init)
    if (envList) return envList
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

const P = '/v3/membership'

/** [argv, verb, path] — argv without the leading `membership`. */
const routes: Array<[string[], string, string]> = [
  [['integrations'], 'GET', `${P}/integrations`],
  [['integrations', '--page-size', '50', '--after', 'cur_1'], 'GET', `${P}/integrations`],
  [['integration', ID], 'GET', `${P}/integrations/${ID}`],
  [['integration', 'save', '--provider', 'GitHub', '--name', 'Main'], 'POST', `${P}/integrations`],
  [['integration', 'enable', ID], 'PUT', `${P}/integrations/${ID}/enable`],
  [['integration', 'disable', ID, '--yes'], 'PUT', `${P}/integrations/${ID}/disable`],
  [['integration', 'delete', ID, '--yes'], 'DELETE', `${P}/integrations/${ID}`],
  [['integration', 'default', ID], 'PUT', `${P}/integrations/${ID}/default`],
]

describe('every membership integration command reaches its route', () => {
  for (const [argv, verb, path] of routes) {
    it(`membership ${argv.join(' ')} → ${verb} ${path}`, async () => {
      const {error} = await runCommand(['membership', ...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe(verb)
      expect(calls[0]?.path).toBe(path)
    })
  }
})

it('covers all 7 membership integration routes of the gateway', () => {
  // The gateway's `[Route]` list for /membership/integrations… (Hub.Membership/Integrations/*.cs).
  expect(new Set(routes.map(([, verb, path]) => `${verb} ${path}`)).size).toBe(7)
})

/** Run a command and return the body of the one request it sent. */
async function bodyOf(argv: string[]): Promise<Record<string, unknown>> {
  const {error} = await runCommand(['membership', ...argv, ...globalArgs])
  expect(error).toBeUndefined()
  expect(calls).toHaveLength(1)
  return calls[0]?.body ?? {}
}

describe('membership integration save', () => {
  it('merges --config into the integration and keeps the flags on top', async () => {
    const body = await bodyOf([
      'integration', 'save', '--provider', 'GitHub', '--name', 'Main', '--id', ID, '--disabled',
      '--config', '{"provider":"Other","integrationName":"ignored","secret":"s3cr3t"}',
    ])
    expect(body).toEqual({integration: {
      provider: 'GitHub', integrationId: ID, integrationName: 'Main', isEnabled: false, secret: 's3cr3t',
    }})
  })

  it('takes the output of `membership integration <id>` back as --config: its viewId becomes the integrationId, the server fields are dropped', async () => {
    const body = await bodyOf([
      'integration', 'save', '--provider', 'GitHub',
      '--config', '{"integration":{"viewId":"int_9","integrationName":"From-get","isEnabled":false,"env":"PROD","lastIntegrationTestSucceeded":true}}',
    ])
    expect(body).toEqual({integration: {provider: 'GitHub', integrationId: 'int_9', integrationName: 'From-get', isEnabled: false}})
  })
})

describe('membership integration bodies', () => {
  it('list sends the paging in the query', async () => {
    const {error} = await runCommand(['membership', 'integrations', '--page-size', '50', '--after', 'cur_1', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls[0]?.query.get('pageSize')).toBe('50')
    expect(calls[0]?.query.get('startingAfter')).toBe('cur_1')
  })

  it('disable and delete refuse to run without --yes in a non-interactive shell, and send nothing', async () => {
    for (const verb of ['disable', 'delete']) {
      const {error} = await runCommand(['membership', 'integration', verb, ID, ...globalArgs])
      expect(error?.message).toContain('Confirmation required')
    }
    expect(calls).toHaveLength(0)
  })

  it('sends nothing on --dry-run', async () => {
    const {error} = await runCommand(['membership', 'integration', 'delete', ID, '--dry-run', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
  })
})
