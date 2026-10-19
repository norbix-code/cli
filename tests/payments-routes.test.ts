import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {envListAnswer} from './_env.js'

/**
 * One row per Payments endpoint: run the command the way a user types it,
 * through oclif and the real `@norbix.ai/ts` transport, and check the verb and
 * path of the request it sends. `fetch` is replaced, so nothing leaves the
 * process and no payment provider is contacted.
 *
 * The order commands go to the Api host (same /v3 prefix), the rest to the Hub.
 * The inbound provider webhook (`POST /payments/webhooks/{acc}/{prj}/{source}/{int}`)
 * is called by Stripe & co., not by a person, so it has no command.
 */

const ID = '66b2f0a1'
const ORD = 'ord_2ToIiRM03X63TZaJ2dJdv2'

interface Call {
  method: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

let calls: Call[]
let realFetch: typeof globalThis.fetch
let dir: string

beforeEach(() => {
  calls = []
  dir = mkdtempSync(join(tmpdir(), 'norbix-payments-'))
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
  rmSync(dir, {recursive: true, force: true})
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

const P = '/v3/payments'

/** A trigger file: a webhook-call action on two Stripe events. */
function triggerFile(extra: Record<string, unknown> = {}): string {
  const file = join(dir, 'trigger.json')
  writeFileSync(
    file,
    JSON.stringify({name: 'Paid', action: {type: 'WebhookCall'}, events: ['payment_intent.succeeded'], ...extra}),
  )
  return file
}

/** [argv, verb, path] — argv without the leading `payments`. */
const routes: Array<[() => string[], string, string]> = [
  // Module
  [() => ['enable'], 'PUT', `${P}/enable`],
  [() => ['disable', '--yes'], 'PUT', `${P}/disable`],
  [() => ['webhook-log'], 'GET', `${P}/webhooks/log`],

  // Integrations
  [() => ['integrations'], 'GET', `${P}/integrations`],
  [() => ['integration', ID], 'GET', `${P}/integrations/${ID}`],
  [() => ['integration', 'save', '--provider', 'Stripe'], 'POST', `${P}/integrations`],
  [() => ['integration', 'test', '--integration', ID], 'POST', `${P}/integrations/test`],
  [() => ['integration', 'enable', ID], 'PUT', `${P}/integrations/${ID}/enable`],
  [() => ['integration', 'disable', ID, '--yes'], 'PUT', `${P}/integrations/${ID}/disable`],
  [() => ['integration', 'delete', ID, '--yes'], 'DELETE', `${P}/integrations/${ID}`],
  [() => ['integration', 'confirm-delivery', ID], 'POST', `${P}/integrations/confirm-human-delivery`],

  // Triggers
  [() => ['triggers'], 'GET', `${P}/triggers`],
  [() => ['trigger', ID], 'GET', `${P}/triggers/${ID}`],
  [() => ['trigger', 'save', '--file', triggerFile()], 'POST', `${P}/triggers`],
  [() => ['trigger', 'enable', ID], 'PATCH', `${P}/triggers/${ID}/enable`],
  [() => ['trigger', 'disable', ID, '--yes'], 'PATCH', `${P}/triggers/${ID}/disable`],
  [() => ['trigger', 'delete', ID, '--yes'], 'DELETE', `${P}/triggers/${ID}`],

  // Orders (Api host)
  [() => ['orders'], 'GET', `${P}/orders`],
  [() => ['order', ORD], 'GET', `${P}/orders/${ORD}`],
  [() => ['order', 'create', '--buyer', 'usr_1', '--reference', 'ad-1', '--key', 'key-00000001', '--line', 'star-day:21:30'], 'POST', `${P}/orders`],
  [() => ['order', 'checkout', ORD, '--integration', 'int_1', '--return-url', 'https://shop.example.com/paid'], 'POST', `${P}/orders/${ORD}/checkout`],
]

describe('every payments command reaches its route', () => {
  for (const [argv, verb, path] of routes) {
    it(`payments … → ${verb} ${path}`, async () => {
      const {error} = await runCommand(['payments', ...argv(), ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe(verb)
      expect(calls[0]?.path).toBe(path)
    })
  }
})

it('covers all 21 payments routes a person calls', () => {
  // The manifests (sdks/typegen/coverage/endpoints.{hub,api}.json) list 17 Hub
  // and 4 Api Payments entries, the same as @norbix.ai/ts 4.29.0; the inbound
  // provider webhook is called by the provider.
  expect(new Set(routes.map(([, verb, path]) => `${verb} ${path}`)).size).toBe(21)
})

/** Run a command and return the one request it sent. */
// Note: @oclif/test's runCommand splits argv on spaces, so no test value here
// contains one.
async function callOf(argv: string[]): Promise<Call> {
  const {error} = await runCommand(['payments', ...argv, ...globalArgs])
  expect(error).toBeUndefined()
  expect(calls).toHaveLength(1)
  return calls[0]!
}

describe('payments enable / disable', () => {
  it('enable turns the module on and takes no trigger ID any more (moved to `trigger enable`)', async () => {
    const {error, stderr} = await runCommand(['payments', 'enable', ID, ...globalArgs])
    expect(error?.oclif?.exit).toBe(2)
    expect(stderr).toContain('Payment trigger toggles moved: `norbix payments trigger enable <id>`')
    expect(calls).toHaveLength(0)
  })

  it('disable asks before turning the module off', async () => {
    const {error} = await runCommand(['payments', 'disable', ...globalArgs])
    expect(error?.message).toMatch(/Confirmation required: Turn off the Payments module/)
    expect(calls).toHaveLength(0)
  })
})

describe('payments webhook-log', () => {
  it('sends the integration and the limit as query parameters', async () => {
    const call = await callOf(['webhook-log', '--integration', ID, '--limit', '10'])
    expect(Object.fromEntries(call.query)).toMatchObject({integrationId: ID, limit: '10'})
  })

  it('refuses a limit above the server ceiling (200)', async () => {
    const {error} = await runCommand(['payments', 'webhook-log', '--limit', '500', ...globalArgs])
    expect(error?.message).toMatch(/less than or equal to 200/)
    expect(calls).toHaveLength(0)
  })
})

describe('payments integration save', () => {
  it('sends the provider as the discriminator with the name and the on switch', async () => {
    const {body} = await callOf(['integration', 'save', '--provider', 'Stripe', '--name', 'Stripe'])
    expect(body).toEqual({integration: {provider: 'Stripe', integrationName: 'Stripe', isEnabled: true}})
  })

  it('merges --config into the integration and keeps the flags on top', async () => {
    const {body} = await callOf([
      'integration', 'save', '--provider', 'Stripe', '--name', 'Stripe', '--id', ID, '--disabled',
      '--config', '{"provider":"PayPal","secretKey":"sk_test_1","webhookSigningSecret":"whsec_1"}',
    ])
    expect(body).toEqual({
      integration: {
        provider: 'Stripe',
        secretKey: 'sk_test_1',
        webhookSigningSecret: 'whsec_1',
        integrationId: ID,
        integrationName: 'Stripe',
        isEnabled: false,
      },
    })
  })

  it('accepts the tier-1 in-app providers', async () => {
    for (const provider of ['AppleInApp', 'GoogleInApp']) {
      calls = []
      const {body} = await callOf(['integration', 'save', '--provider', provider])
      expect((body?.integration as Record<string, unknown>).provider).toBe(provider)
    }
  })

  it('rejects a provider the server does not know', async () => {
    const {error} = await runCommand(['payments', 'integration', 'save', '--provider', 'Nope', ...globalArgs])
    expect(error?.message).toMatch(/Expected --provider=Nope to be one of/)
    expect(calls).toHaveLength(0)
  })
})

describe('payments integration test / confirm-delivery', () => {
  it('test sends the integration id in the body', async () => {
    expect((await callOf(['integration', 'test', '--integration', ID])).body).toEqual({integrationId: ID})
  })

  it('confirm-delivery sends the integration id in the body', async () => {
    expect((await callOf(['integration', 'confirm-delivery', ID])).body).toEqual({integrationId: ID})
  })
})

describe('payments trigger save', () => {
  it('fills type Payments and when OnWebhookCallReceived and keeps the file', async () => {
    const {body} = await callOf(['trigger', 'save', '--file', triggerFile()])
    expect(body).toEqual({
      trigger: {
        type: 'Payments',
        when: 'OnWebhookCallReceived',
        name: 'Paid',
        action: {type: 'WebhookCall'},
        events: ['payment_intent.succeeded'],
      },
    })
  })

  it('takes the whole request body ({"trigger": {...}}) too', async () => {
    const file = join(dir, 'body.json')
    writeFileSync(file, JSON.stringify({trigger: {name: 'Paid', action: {type: 'WebhookCall'}}}))
    const {body} = await callOf(['trigger', 'save', '--file', file])
    expect(body?.trigger).toMatchObject({type: 'Payments', name: 'Paid'})
  })

  it('takes a `payments trigger <id> --json` answer: item unwrapped, thenAction saved as action', async () => {
    const file = join(dir, 'read.json')
    writeFileSync(file, JSON.stringify({item: {name: 'Paid', thenAction: {type: 'WebhookCall'}, events: ['invoice.paid']}}))
    const {body} = await callOf(['trigger', 'save', '--file', file])
    expect(body?.trigger).toEqual({
      type: 'Payments',
      when: 'OnWebhookCallReceived',
      name: 'Paid',
      action: {type: 'WebhookCall'},
      events: ['invoice.paid'],
    })
  })

  it('lets the flags override the file', async () => {
    const {body} = await callOf([
      'trigger', 'save', '--file', triggerFile({order: 5}), '--id', ID,
      '--event', 'charge.refunded', '--event', 'invoice.paid', '--integration', 'int_1',
      '--order', '1', '--break-on-error',
    ])
    expect(body?.trigger).toMatchObject({
      triggerId: ID,
      events: ['charge.refunded', 'invoice.paid'],
      integrations: ['int_1'],
      order: 1,
      breakOnError: true,
    })
  })
})

describe('payments trigger enable / disable / delete', () => {
  for (const [sub, verb] of [['enable', 'PATCH'], ['disable', 'PATCH'], ['delete', 'DELETE']] as const) {
    it(`${sub} puts the trigger id in the path and nothing else`, async () => {
      const call = await callOf(['trigger', sub, ID, ...(sub === 'enable' ? [] : ['--yes'])])
      expect(call.method).toBe(verb)
      expect(call.path).toContain(`/triggers/${ID}`)
    })
  }
})

describe('payments trigger save --when', () => {
  it('saves an order trigger with the Norbix order events', async () => {
    const {body} = await callOf([
      'trigger', 'save', '--file', triggerFile({events: undefined}), '--when', 'OnOrderPaymentChanged',
      '--event', 'payments.order.refunded',
    ])
    expect(body?.trigger).toMatchObject({type: 'Payments', when: 'OnOrderPaymentChanged', events: ['payments.order.refunded']})
  })

  it('keeps the file\'s when unless --when is given', async () => {
    const {body} = await callOf(['trigger', 'save', '--file', triggerFile({when: 'OnOrderPaid', events: []})])
    expect(body?.trigger).toMatchObject({when: 'OnOrderPaid'})
  })

  it('refuses a trigger type the server does not fire', async () => {
    const {error} = await runCommand(['payments', 'trigger', 'save', '--file', triggerFile(), '--when', 'OnOrderCreated', ...globalArgs])
    expect(error?.message).toMatch(/Expected --when=OnOrderCreated to be one of/)
    expect(calls).toHaveLength(0)
  })
})

describe('payments integration save --provider Montonio', () => {
  it('sends the Montonio keys from --config', async () => {
    const {body} = await callOf([
      'integration', 'save', '--provider', 'Montonio', '--name', 'Montonio',
      '--config', '{"accessKey":"ak_1","secretKey":"sk_1","isSandbox":true}',
    ])
    expect(body).toEqual({
      integration: {accessKey: 'ak_1', secretKey: 'sk_1', isSandbox: true, provider: 'Montonio', integrationName: 'Montonio', isEnabled: true},
    })
  })
})

describe('payments order create', () => {
  it('turns the flags into the order body, EUR and v1 by default', async () => {
    const {body} = await callOf([
      'order', 'create', '--buyer', 'usr_1', '--reference', 'ad-1042', '--key', 'promo-1042-0001',
      '--line', 'star-day:21:30', '--line', 'highlight-day:7:30:Highlight', '--meta', 'adId=ad_1042',
    ])
    expect(body).toEqual({
      buyerUserId: 'usr_1',
      merchantReference: 'ad-1042',
      idempotencyKey: 'promo-1042-0001',
      currency: 'EUR',
      priceVersion: 'v1',
      lines: [
        {sku: 'star-day', quantity: 21, unitAmountMinor: 30},
        {sku: 'highlight-day', quantity: 7, unitAmountMinor: 30, title: 'Highlight'},
      ],
      metadata: {adId: 'ad_1042'},
    })
  })

  it('takes the body from --file and lets the flags override it', async () => {
    const file = join(dir, 'order.json')
    writeFileSync(file, JSON.stringify({
      buyerUserId: 'usr_file', merchantReference: 'ref-file', idempotencyKey: 'key-file-0001', currency: 'EUR',
      priceVersion: '2026-10-01', lines: [{sku: 'star-day', title: 'Star × day', quantity: 21, unitAmountMinor: 30}],
      metadata: {adId: 'ad_1'},
    }))
    const {body} = await callOf(['order', 'create', '--file', `@${file}`, '--reference', 'ref-flag', '--meta', 'promotion=stars'])
    expect(body).toMatchObject({
      buyerUserId: 'usr_file',
      merchantReference: 'ref-flag',
      priceVersion: '2026-10-01',
      metadata: {adId: 'ad_1', promotion: 'stars'},
    })
  })

  it('refuses a malformed --line before sending anything', async () => {
    const {error} = await runCommand(['payments', 'order', 'create', '--line', 'star-day:zero:30', ...globalArgs])
    expect(error?.message).toMatch(/must be sku:quantity:unitCents/)
    expect(calls).toHaveLength(0)
  })
})

describe('payments orders / order / checkout', () => {
  it('orders sends the filters as query parameters', async () => {
    const call = await callOf(['orders', '--buyer', 'usr_1', '--reference', 'ad-1', '--status', 'Paid'])
    expect(Object.fromEntries(call.query)).toMatchObject({buyerUserId: 'usr_1', merchantReference: 'ad-1', status: 'Paid'})
  })

  it('checkout sends the integration, the return URL and the options in the body', async () => {
    const call = await callOf([
      'order', 'checkout', ORD, '--integration', 'int_1', '--return-url', 'https://shop.example.com/paid',
      '--method', 'bankLink', '--country', 'LT',
    ])
    expect(call.path).toBe(`${P}/orders/${ORD}/checkout`)
    expect(call.body).toMatchObject({integrationId: 'int_1', returnUrl: 'https://shop.example.com/paid', method: 'bankLink', preferredCountry: 'LT'})
  })

  it('checkout needs --integration and --return-url', async () => {
    const {error} = await runCommand(['payments', 'order', 'checkout', ORD, ...globalArgs])
    expect(error?.message).toMatch(/Missing required flag/)
    expect(calls).toHaveLength(0)
  })
})
