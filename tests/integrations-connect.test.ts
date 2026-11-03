import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {render} from '../src/commands/payments/integration/connect/start.js'
import {envListAnswer} from './_env.js'

/**
 * Quick connect (one-click OAuth) of a payments integration — the five routes
 * of Hub.Payments/Integrations/Connect/QuickConnect.cs a person calls: the
 * provider list and the targets of a connect (shared `/integrations/connect/…`
 * routes, `norbix integrations connect …`) and start / complete / disconnect
 * (`norbix payments integration connect …`). Run through oclif and the real
 * `@norbix.ai/ts` transport with `fetch` replaced: nothing leaves the process.
 *
 * Not commands: `GET|POST /integrations/connect/callback/{Provider}` (the
 * provider sends the person back there) and `GET
 * /integrations/connect/devfake/authorize` (the fake provider's page).
 */

const ID = '66b2f0a1'
const CONNECT = 'qc_7IEb8WjfRcwer3LPwl7fd6'

interface Call {
  method: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

const ANSWER = {
  authorizeUrl: 'https://shop.example.com/wc-auth/v1/authorize?x=1',
  connectId: CONNECT,
  redirectUrl: 'https://hub.norbix.ai/v3/integrations/connect/callback/woocommerce',
  expiresAt: '2026-11-03T10:10:00Z',
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
    return new Response(JSON.stringify(ANSWER), {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

/** [argv, verb, path] — the whole argv after `norbix`. */
const routes: Array<[string[], string, string]> = [
  [['integrations', 'connect', 'providers'], 'GET', '/v3/integrations/connect/providers'],
  [['integrations', 'connect', 'providers', '--module', 'payments'], 'GET', '/v3/integrations/connect/providers'],
  [['integrations', 'connect', 'targets', CONNECT], 'GET', `/v3/integrations/connect/${CONNECT}/targets`],
  [['payments', 'integration', 'connect', 'start', '--provider', 'woocommerce', '--name', 'Shop'], 'POST', '/v3/payments/integrations/connect/start'],
  [['payments', 'integration', 'connect', 'complete', CONNECT, '--target', 'shop_42'], 'POST', `/v3/payments/integrations/connect/${CONNECT}/complete`],
  [['payments', 'integration', 'connect', 'disconnect', ID, '--yes'], 'POST', `/v3/payments/integrations/${ID}/connect/disconnect`],
]

describe('every quick-connect command reaches its route', () => {
  for (const [argv, verb, path] of routes) {
    it(`norbix ${argv.join(' ')} → ${verb} ${path}`, async () => {
      const {error} = await runCommand([...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe(verb)
      expect(calls[0]?.path).toBe(path)
    })
  }

  it('covers the 5 quick-connect routes a person calls', () => {
    expect(new Set(routes.map(([, verb, path]) => `${verb} ${path}`)).size).toBe(5)
  })
})

async function callOf(argv: string[]): Promise<Call> {
  const {error} = await runCommand([...argv, ...globalArgs])
  expect(error).toBeUndefined()
  expect(calls).toHaveLength(1)
  return calls[0]!
}

describe('integrations connect providers / targets', () => {
  it('providers sends the module filter in the query, nothing without it', async () => {
    expect((await callOf(['integrations', 'connect', 'providers'])).query.has('module')).toBe(false)
    calls = []
    expect((await callOf(['integrations', 'connect', 'providers', '--module', 'payments'])).query.get('module')).toBe('payments')
  })

  it('targets puts the connect id in the path and sends no body', async () => {
    const call = await callOf(['integrations', 'connect', 'targets', CONNECT])
    expect(call.body).toBeUndefined()
    expect(call.query.has('connectId')).toBe(false)
  })
})

describe('payments integration connect start', () => {
  it('sends the provider, the name, the mode, the inputs and the reconnect id', async () => {
    const call = await callOf([
      'payments', 'integration', 'connect', 'start', '--provider', 'woocommerce', '--name', 'Shop',
      '--mode', 'test', '--input', 'storeUrl=https://shop.example.com', '--input', 'region=eu', '--integration', ID,
    ])
    expect(call.body).toEqual({
      provider: 'woocommerce',
      integrationName: 'Shop',
      mode: 'test',
      input: {storeUrl: 'https://shop.example.com', region: 'eu'},
      integrationId: ID,
    })
  })

  it('sends only the provider and the name when nothing else is given', async () => {
    const call = await callOf(['payments', 'integration', 'connect', 'start', '--provider', 'woocommerce', '--name', 'Shop'])
    expect(call.body).toEqual({provider: 'woocommerce', integrationName: 'Shop'})
  })

  it('refuses an --input without =, before sending anything', async () => {
    const {error} = await runCommand(['payments', 'integration', 'connect', 'start', '--provider', 'woocommerce', '--name', 'Shop', '--input', 'storeUrl', ...globalArgs])
    expect(error?.message).toContain('must be key=value')
    expect(calls).toHaveLength(0)
  })

  it('returns the gateway answer (what --json prints)', async () => {
    const {result, error} = await runCommand(['payments', 'integration', 'connect', 'start', '--provider', 'woocommerce', '--name', 'Shop', '--json', ...globalArgs])
    expect(error).toBeUndefined()
    expect(result).toEqual(ANSWER)
  })

  it('the human view prints the page to open, the connect id and the next commands', () => {
    expect(render(ANSWER)).toEqual([
      `Open in a browser: ${ANSWER.authorizeUrl}`,
      `Connect id:        ${CONNECT}`,
      'Expires at:        2026-11-03T10:10:00Z',
      '',
      'Once approved, pick the account:',
      `  norbix integrations connect targets ${CONNECT}`,
      `  norbix payments integration connect complete ${CONNECT} --target <id>`,
    ])
  })
})

describe('payments integration connect complete', () => {
  // The transport moves `connectId` from the body into the `{ConnectId}` path token.
  it('sends the target and isEnabled true by default', async () => {
    const call = await callOf(['payments', 'integration', 'connect', 'complete', CONNECT, '--target', 'shop_42'])
    expect(call.body).toEqual({targetId: 'shop_42', isEnabled: true})
  })

  it('--disabled saves the integration turned off', async () => {
    const call = await callOf(['payments', 'integration', 'connect', 'complete', CONNECT, '--target', 'shop_42', '--disabled'])
    expect(call.body).toEqual({targetId: 'shop_42', isEnabled: false})
  })

  it('needs --target', async () => {
    const {error} = await runCommand(['payments', 'integration', 'connect', 'complete', CONNECT, ...globalArgs])
    expect(error?.message).toContain('target')
    expect(calls).toHaveLength(0)
  })
})

describe('payments integration connect disconnect', () => {
  it('sends the id in the path only — the transport moves it out of the body', async () => {
    const call = await callOf(['payments', 'integration', 'connect', 'disconnect', ID, '--yes'])
    expect(call.body).toBeUndefined()
  })

  it('refuses to run without --yes in a non-interactive shell, and sends nothing', async () => {
    const {error} = await runCommand(['payments', 'integration', 'connect', 'disconnect', ID, ...globalArgs])
    expect(error?.message).toContain('Confirmation required')
    expect(calls).toHaveLength(0)
  })

  it('sends nothing on --dry-run', async () => {
    const {error} = await runCommand(['payments', 'integration', 'connect', 'disconnect', ID, '--dry-run', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
  })
})
