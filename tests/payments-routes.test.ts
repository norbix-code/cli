import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {envListAnswer} from './_env.js'
import {formatWebhookRun, formatWebhookRuns, webhookRunAnswer, webhookRunTriggers} from '../src/lib/payments.js'

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
const RUN = 'pwr_1p4R3gTobGZpD6fXvHT4rd'

interface Call {
  method: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

let calls: Call[]
/** What the fake Hub answers; a test may set it before running a command. */
let answer: string
let realFetch: typeof globalThis.fetch
let dir: string

beforeEach(() => {
  calls = []
  answer = '{}'
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
    return new Response(answer, {status: 200, headers: {'Content-Type': 'application/json'}})
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
  [() => ['webhook-runs'], 'GET', `${P}/webhooks/runs`],
  [() => ['webhook-run', RUN], 'GET', `${P}/webhooks/runs/${RUN}`],

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

it('covers all 23 payments routes a person calls', () => {
  // The manifests (sdks/typegen/coverage/endpoints.{hub,api}.json) list 19 Hub
  // and 4 Api Payments entries (the two webhook-runs routes since gateway
  // 86f24ecd2); the inbound provider webhook is called by the provider.
  expect(new Set(routes.map(([, verb, path]) => `${verb} ${path}`)).size).toBe(23)
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

  it('leaves isSandbox out when --config has none (empty = true on the gateway: sandbox)', async () => {
    const {body} = await callOf([
      'integration', 'save', '--provider', 'Montonio', '--name', 'Montonio',
      '--config', '{"accessKey":"ak_1","secretKey":"sk_1"}',
    ])
    expect(body).toEqual({
      integration: {accessKey: 'ak_1', secretKey: 'sk_1', provider: 'Montonio', integrationName: 'Montonio', isEnabled: true},
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
        {sku: 'star-day', quantity: 21, unitAmountMinor: 30, title: 'star-day'},
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

  it('refuses a 0-cent line (the server needs 1 cent or more)', async () => {
    const {error} = await runCommand(['payments', 'order', 'create', '--line', 'star-day:21:0', ...globalArgs])
    expect(error?.message).toMatch(/cents 1 or more/)
    expect(calls).toHaveLength(0)
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

/** A received event as GET /payments/webhooks/runs answers it: refused, two trigger actions. */
const RUN_ROW = {
  id: RUN,
  callId: 'pwc_7Hq2mN4bV8cX1zL6kP3rT9',
  env: 'PROD',
  integrationId: 'int_stripe',
  source: 'Stripe',
  receivedOn: '2026-10-26T08:00:00Z',
  statusCode: 400,
  outcome: 'Refused',
  reason: 'signature-mismatch',
  description: 'Signature does not match.',
  eventName: 'payment_intent.succeeded',
  providerEventId: 'evt_1',
  correlationId: 'corr-1',
  order: {orderId: 'ord_1', kind: 'Applied', from: 'Pending', to: 'Paid', reason: 'paid'},
  actions: [
    {triggerId: 'trg_email', triggerName: 'Receipt', action: 'Email', status: 'Sent', queue: 'emails', norbixEvent: 'payments.order.paid', at: '2026-10-26T08:00:01Z'},
    {triggerId: 'trg_hook', action: 'WebhookCall', status: 'Sent', deliveries: 2, norbixEvent: 'payments.order.paid', at: '2026-10-26T08:00:01Z'},
    {triggerId: 'trg_code', action: 'Code', status: 'Skipped', reason: 'condition false', norbixEvent: 'payments.webhook.received', at: '2026-10-26T08:00:01Z'},
  ],
  part: 1,
  parts: 1,
}

const RAW_CALL = {
  callId: 'pwc_7Hq2mN4bV8cX1zL6kP3rT9',
  receivedOn: '2026-10-26T08:00:00Z',
  contentType: 'application/json',
  body: '{"id":"evt_1","data":{"name":"J*** D***"}}',
  truncated: false,
  maskedFields: 1,
  headers: {'Stripe-Signature': 't=1,v1=…'},
  answerStatus: 400,
  answerBody: '{"error":"signature"}',
  parts: 1,
}

describe('payments webhook-runs', () => {
  it('sends every filter and the paging as query parameters, no body', async () => {
    const call = await callOf([
      'webhook-runs', '--integration', 'int_stripe', '--event', 'payment_intent.succeeded', '--trigger', 'trg_email',
      '--outcome', 'refused', '--from', '2026-10-25T00:00:00Z', '--to', '2026-10-26T00:00:00Z',
      '--page-size', '20', '--after', 'pwr_prev',
    ])
    expect(call.method).toBe('GET')
    expect(call.path).toBe(`${P}/webhooks/runs`)
    expect(Object.fromEntries(call.query)).toMatchObject({
      integrationId: 'int_stripe',
      eventName: 'payment_intent.succeeded',
      triggerId: 'trg_email',
      outcome: 'refused',
      fromUtc: '2026-10-25T00:00:00Z',
      toUtc: '2026-10-26T00:00:00Z',
      pageSize: '20',
      startingAfter: 'pwr_prev',
    })
    expect(call.body).toBeUndefined()
  })

  it('--before pages backwards', async () => {
    const call = await callOf(['webhook-runs', '--before', 'pwr_next'])
    expect(call.query.get('endingBefore')).toBe('pwr_next')
    expect(call.query.has('startingAfter')).toBe(false)
  })

  it('refuses an unknown --outcome and --after with --before before sending anything', async () => {
    const bad = await runCommand(['payments', 'webhook-runs', '--outcome', 'paid', ...globalArgs])
    expect(bad.error?.message).toMatch(/Expected --outcome=paid to be one of: applied, ignored, refused, failed, all/)
    const both = await runCommand(['payments', 'webhook-runs', '--after', 'a', '--before', 'b', ...globalArgs])
    expect(both.error?.message).toMatch(/cannot also be provided/)
    expect(calls).toHaveLength(0)
  })

  it('returns the page as the Hub sent it (what --json prints)', async () => {
    answer = JSON.stringify({list: {items: [RUN_ROW], hasMore: false}})
    const {result, error} = await runCommand(['payments', 'webhook-runs', ...globalArgs])
    expect(error).toBeUndefined()
    expect(result).toEqual({list: {items: [RUN_ROW], hasMore: false}})
  })
})

describe('payments webhook-run', () => {
  it('puts the run id in the path, nowhere else', async () => {
    const call = await callOf(['webhook-run', RUN])
    expect(call.path).toBe(`${P}/webhooks/runs/${RUN}`)
    expect(call.query.has('id')).toBe(false)
    expect(call.body).toBeUndefined()
  })

  it('returns the run without the raw call unless --raw is given (what --json prints)', async () => {
    answer = JSON.stringify({item: {run: RUN_ROW, raw: RAW_CALL}})
    const plain = await runCommand(['payments', 'webhook-run', RUN, ...globalArgs])
    expect(plain.error).toBeUndefined()
    expect(JSON.parse(JSON.stringify(plain.result))).toEqual({item: {run: RUN_ROW}})
    const raw = await runCommand(['payments', 'webhook-run', RUN, '--raw', ...globalArgs])
    expect(raw.result).toEqual({item: {run: RUN_ROW, raw: RAW_CALL}})
  })
})

describe('webhook run formatting', () => {
  it('answer and trigger cells', () => {
    expect(webhookRunAnswer({statusCode: 200, outcome: 'Applied', reason: 'processed'})).toBe('200 Applied')
    expect(webhookRunAnswer({statusCode: 200, outcome: 'Ignored', reason: 'duplicate'})).toBe('200 Ignored — duplicate')
    expect(webhookRunAnswer({statusCode: 500, outcome: 'Failed', reason: 'unexpected'})).toBe('500 Failed — unexpected')
    expect(webhookRunTriggers([])).toBe('—')
    expect(webhookRunTriggers([{status: 'Failed'}, {status: 'NotRun'}, {status: 'Sent'}, {status: 'NotRun'}])).toBe('1 sent · 1 failed · 2 not run')
  })

  it('the list table: received, integration, event, answer, triggers summary, run id, next page', () => {
    const out = formatWebhookRuns({
      list: {
        items: [RUN_ROW, {...RUN_ROW, id: 'pwr_2', statusCode: 200, outcome: 'Applied', reason: 'processed', actions: []}],
        hasMore: true,
        startingAfter: 'pwr_2',
      },
    })
    const lines = out.split('\n')
    expect(lines[0]).toMatch(/^RECEIVED +INTEGRATION +EVENT +ANSWER +TRIGGERS +RUN$/)
    expect(lines[1]).toMatch(/^2026-10-26T08:00:00Z +int_stripe \(Stripe\) +payment_intent\.succeeded +400 Refused — signature-mismatch +2 sent · 1 skipped +pwr_1p4R3gTobGZpD6fXvHT4rd$/)
    expect(lines[2]).toMatch(/ 200 Applied +— +pwr_2$/)
    expect(out).toContain('2 runs. Read one: norbix payments webhook-run <run>')
    expect(out).toContain('More: add --after pwr_2')
  })

  it('one run: answer, order change, every trigger action; the raw call only with raw', () => {
    const plain = formatWebhookRun({item: {run: RUN_ROW}})
    expect(plain).toContain('Answer       400 Refused — signature-mismatch: Signature does not match.')
    expect(plain).toContain('Order        ord_1 Applied Pending → Paid — paid')
    expect(plain).toContain('Log trail    norbix logs trail corr-1')
    expect(plain).toContain('Triggers     2 sent · 1 skipped')
    expect(plain).toMatch(/Sent +Receipt \(trg_email\) +Email +payments\.order\.paid +queue emails/)
    expect(plain).toContain('2 deliveries')
    expect(plain).toMatch(/Skipped +trg_code +Code +payments\.webhook\.received +condition false/)
    expect(plain).not.toContain('Stripe-Signature')
    expect(plain).toContain('add --raw')

    const raw = formatWebhookRun({item: {run: RUN_ROW, raw: RAW_CALL}}, {raw: true})
    expect(raw).toContain('Raw call pwc_7Hq2mN4bV8cX1zL6kP3rT9: application/json, 1 value(s) masked')
    expect(raw).toContain('  Stripe-Signature: t=1,v1=…')
    expect(raw).toContain('"name": "J*** D***"')
    expect(raw).toContain('Answered 400 {"error":"signature"}')
  })

  it('empty pages, a split call and an expired raw call say so', () => {
    expect(formatWebhookRuns({list: {items: []}})).toBe('No received payment webhooks match (records are kept 30 days).')
    expect(formatWebhookRuns({list: {items: [{...RUN_ROW, part: 2, parts: 3}]}})).toContain('payment_intent.succeeded [2/3]')
    expect(formatWebhookRun({item: {run: RUN_ROW, raw: null}}, {raw: true})).toContain('Raw call: not kept')
    expect(formatWebhookRun({})).toBe('No such received payment webhook.')
  })
})
