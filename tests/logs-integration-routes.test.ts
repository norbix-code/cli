import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {envListAnswer} from './_env.js'

/**
 * One row per logs integration endpoint: run the command the way a user
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

const P = '/v3/logs'

/** [argv, verb, path] — argv without the leading `logs`. */
const routes: Array<[string[], string, string]> = [
  [['integrations'], 'GET', `${P}/integrations`],
  [['integrations', '--page-size', '50', '--after', 'cur_1'], 'GET', `${P}/integrations`],
  [['integration', ID], 'GET', `${P}/integrations/${ID}`],
  [['integration', 'save', '--provider', 'DataDog', '--name', 'Main'], 'POST', `${P}/integrations`],
  [['integration', 'enable', ID], 'PUT', `${P}/integrations/${ID}/enable`],
  [['integration', 'disable', ID, '--yes'], 'PUT', `${P}/integrations/${ID}/disable`],
  [['integration', 'delete', ID, '--yes'], 'DELETE', `${P}/integrations/${ID}`],
  [['integration', 'test', '--integration', ID], 'POST', `${P}/integrations/test`],
]

describe('every logs integration command reaches its route', () => {
  for (const [argv, verb, path] of routes) {
    it(`logs ${argv.join(' ')} → ${verb} ${path}`, async () => {
      const {error} = await runCommand(['logs', ...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe(verb)
      expect(calls[0]?.path).toBe(path)
    })
  }
})

it('covers all 7 logs integration routes of the gateway', () => {
  // The gateway's `[Route]` list for /logs/integrations… (Hub.Logs/Integrations/*.cs).
  expect(new Set(routes.map(([, verb, path]) => `${verb} ${path}`)).size).toBe(7)
})

/** Run a command and return the body of the one request it sent. */
async function bodyOf(argv: string[]): Promise<Record<string, unknown>> {
  const {error} = await runCommand(['logs', ...argv, ...globalArgs])
  expect(error).toBeUndefined()
  expect(calls).toHaveLength(1)
  return calls[0]?.body ?? {}
}

describe('logs integration save', () => {
  it('merges --config into the integration and keeps the flags on top', async () => {
    const body = await bodyOf([
      'integration', 'save', '--provider', 'DataDog', '--name', 'Main', '--id', ID, '--disabled',
      '--config', '{"provider":"Other","integrationName":"ignored","secret":"s3cr3t"}',
    ])
    expect(body).toEqual({integration: {
      provider: 'DataDog', integrationId: ID, integrationName: 'Main', isEnabled: false, secret: 's3cr3t',
    }})
  })

  it('takes the output of `logs integration <id>` back as --config: its viewId becomes the integrationId, the server fields are dropped', async () => {
    const body = await bodyOf([
      'integration', 'save', '--provider', 'DataDog',
      '--config', '{"integration":{"viewId":"int_9","integrationName":"From-get","isEnabled":false,"env":"PROD","lastIntegrationTestSucceeded":true}}',
    ])
    expect(body).toEqual({integration: {provider: 'DataDog', integrationId: 'int_9', integrationName: 'From-get', isEnabled: false}})
  })

  it('keyless: --config without authMode is sent as it is — the gateway reads no authMode as Keyless', async () => {
    const body = await bodyOf([
      'integration', 'save', '--provider', 'DataDog', '--name', 'Keyless', '--id', ID,
      '--config', '{"region":"eu-central-1","roleArn":"arn:aws:iam::123456789012:role/norbix"}',
    ])
    expect(body).toEqual({integration: {
      provider: 'DataDog', integrationId: ID, integrationName: 'Keyless', isEnabled: true,
      region: 'eu-central-1', roleArn: 'arn:aws:iam::123456789012:role/norbix',
    }})
    expect((body.integration as Record<string, unknown>).authMode).toBeUndefined()
  })

  it('a key mode travels with its acceptKeyRisk tick (the gateway refuses it without: CM-ERRORS-INTEGRATIONS-034)', async () => {
    const body = await bodyOf([
      'integration', 'save', '--provider', 'DataDog', '--name', 'Key',
      '--config', '{"authMode":"AccessKey","acceptKeyRisk":true}',
    ])
    expect(body.integration).toMatchObject({authMode: 'AccessKey', acceptKeyRisk: true})
  })
})

describe('logs integration bodies', () => {
  it('list sends the paging in the query', async () => {
    const {error} = await runCommand(['logs', 'integrations', '--page-size', '50', '--after', 'cur_1', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls[0]?.query.get('pageSize')).toBe('50')
    expect(calls[0]?.query.get('startingAfter')).toBe('cur_1')
  })

  it('test sends the integration id in the body', async () => {
    expect(await bodyOf(['integration', 'test', '--integration', ID])).toEqual({integrationId: ID})
  })

  it('disable and delete refuse to run without --yes in a non-interactive shell, and send nothing', async () => {
    for (const verb of ['disable', 'delete']) {
      const {error} = await runCommand(['logs', 'integration', verb, ID, ...globalArgs])
      expect(error?.message).toContain('Confirmation required')
    }
    expect(calls).toHaveLength(0)
  })

  it('sends nothing on --dry-run', async () => {
    const {error} = await runCommand(['logs', 'integration', 'delete', ID, '--dry-run', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
  })
})
