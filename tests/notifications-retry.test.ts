import {mkdirSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

import {runCommand} from '@oclif/test'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

import {CREDENTIALS_CHANGED_CODE, CREDENTIALS_CHANGED_MESSAGE, toEnvelope} from '../src/lib/cli-error.js'
import {credentialVersionOf} from '../src/lib/device-login.js'
import {EXIT} from '../src/lib/exit-codes.js'
import {responseError} from '../src/lib/http-response.js'
import {describeStats, stateLabel} from '../src/lib/notifications.js'
import {cli, makeHome, parseSingleJson, startFakeGateway, type FakeGateway} from './_cli.js'
import {envListAnswer} from './_env.js'

/**
 * Gateway 2.3.9 (N-28 + N-29) in the CLI: `email|sms|push retry-failed` and
 * `notifications`, the delivery-event flags of the integration save commands,
 * the human statistics, and the credential version of a sign-in.
 *
 * The first block runs the commands through oclif with `fetch` replaced (verb,
 * path, body); the second runs the BUILT CLI against the fake gateway, as an
 * agent sees it (exit code, envelope).
 */

const ID = '66b2f0a1c3d4e5f6a7b8c9d0'
const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

interface Call {
  method: string
  path: string
  headers: Record<string, string>
  body?: Record<string, unknown>
}

let calls: Call[]
let answers: Array<{status: number; body: unknown}>
let realFetch: typeof globalThis.fetch
let printed: string[]
let warned: string[]

beforeEach(() => {
  calls = []
  answers = []
  printed = []
  warned = []
  vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
    printed.push(parts.join(' '))
  })
  vi.spyOn(console, 'error').mockImplementation((...parts: unknown[]) => {
    warned.push(parts.join(' '))
  })
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const envList = envListAnswer(input, init)
    if (envList) return envList
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v))
    calls.push({
      method: init?.method ?? 'GET',
      path: url.pathname,
      headers,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
    })
    const next = answers.shift() ?? {status: 200, body: {}}
    return new Response(JSON.stringify(next.body), {status: next.status, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

describe('retry-failed', () => {
  it('names who the send gates stopped, apart from the rows left out', async () => {
    answers.push({
      status: 200,
      body: {
        retryRequestId: 'rtr_2',
        selected: 4,
        skipped: {AlreadyAccepted: 1, optedOut: 2, compliance: 1, undeliverable: 1},
        replayed: true,
      },
    })
    const {error} = await runCommand(['email', 'retry-failed', ID, '--key', 'k-1', ...globalArgs])
    expect(error).toBeUndefined()
    expect(printed.join('\n')).toContain('Skipped: 1 AlreadyAccepted.')
    expect(printed.join('\n')).toContain(
      'Stopped by the send gates: 2 opted out, 1 stopped by a compliance rule, 1 undeliverable (counted in the 4).',
    )
  })

  for (const channel of ['email', 'sms', 'push'] as const) {
    it(`${channel}: POST .../campaigns/{Id}/retry-failed with the selection in the body`, async () => {
      answers.push({status: 200, body: {retryRequestId: 'rtr_1', selected: 2, skipped: {AlreadyAccepted: 5, Ambiguous: 1}, replayed: false}})
      const {result, error} = await runCommand<{selected: number}>([
        channel, 'retry-failed', ID, '--key', 'k-1', '--notification', 'n_1', '--notification', 'n_2', '--category', 'Transient', '--env', 'TEST', ...globalArgs,
      ])
      expect(error).toBeUndefined()
      const call = calls.find((c) => c.path.endsWith('/retry-failed'))!
      expect(call.method).toBe('POST')
      expect(call.path).toBe(`/v3/notifications/${channel}/campaigns/${ID}/retry-failed`)
      expect(call.headers['norbix-env']).toBe('TEST')
      expect(call.headers['norbix-project-id']).toBe('test-project')
      expect(call.body).toEqual({idempotencyKey: 'k-1', notificationIds: ['n_1', 'n_2'], categories: ['Transient']})
      expect(result?.selected).toBe(2)
      expect(printed.join('\n')).toMatch(/Retrying 2 failed .* recipients/)
      expect(printed.join('\n')).toMatch(/Skipped: 5 AlreadyAccepted, 1 Ambiguous/)
      expect(printed.join('\n')).toMatch(/rtr_1/)
    })
  }

  it('--include-ambiguous sends the flag, warns on stderr and prints the hub warning', async () => {
    answers.push({status: 200, body: {retryRequestId: 'rtr_2', selected: 1, warning: 'may send a duplicate'}})
    const {error} = await runCommand(['email', 'retry-failed', ID, '--key', 'k-2', '--include-ambiguous', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls.find((c) => c.path.endsWith('/retry-failed'))!.body).toEqual({idempotencyKey: 'k-2', includeAmbiguous: true})
    expect(warned.join('\n')).toMatch(/MAY SEND A DUPLICATE/)
    expect(printed.join('\n')).toMatch(/Warning: may send a duplicate/)
  })

  it('a replayed key says so and sends nothing new', async () => {
    answers.push({status: 200, body: {retryRequestId: 'rtr_1', selected: 2, replayed: true}})
    const {error} = await runCommand(['sms', 'retry-failed', ID, '--key', 'k-1', ...globalArgs])
    expect(error).toBeUndefined()
    expect(printed.join('\n')).toMatch(/Already done: this key was used before/)
  })

  it('--dry-run prints the request and sends nothing', async () => {
    const {error} = await runCommand(['push', 'retry-failed', ID, '--key', 'k-3', '--dry-run', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls.filter((c) => c.path.endsWith('/retry-failed'))).toHaveLength(0)
  })

  it('refuses a key longer than 64 characters before sending', async () => {
    const {error} = await runCommand(['email', 'retry-failed', ID, '--key', 'x'.repeat(65), ...globalArgs])
    expect(error?.message).toMatch(/--key must be 1 to 64 characters/)
    expect(calls).toHaveLength(0)
  })

  it('--category accepts only the three retryable classes', async () => {
    const {error} = await runCommand(['email', 'retry-failed', ID, '--key', 'k', '--category', 'Ambiguous', ...globalArgs])
    expect(error?.message).toMatch(/Expected --category/)
  })
})

describe('notifications', () => {
  it('prints the Blocked outcome of the last attempt', async () => {
    answers.push({status: 200, body: {list: {items: [{id: 'b1'}], hasMore: false}}})
    answers.push({
      status: 200,
      body: {list: {items: [{notificationId: 'n1', state: 'Blocked', attempts: [{number: 1, outcome: 'Blocked', message: 'opted out'}]}], hasMore: false}},
    })
    const {error} = await runCommand(['sms', 'notifications', ID, ...globalArgs])
    expect(error).toBeUndefined()
    expect(printed.join('\n')).toContain('n1  Blocked  1 attempt  last attempt Blocked')
  })

  it('walks every batch, lists the rows per batch and filters --state client-side', async () => {
    answers.push({status: 200, body: {list: {items: [{batchId: 'b1'}, {batchId: 'b2'}], hasMore: false}}})
    answers.push({status: 200, body: {list: {items: [{notificationId: 'n1', state: 'Accepted', attempts: [{number: 1, outcome: 'Accepted'}]}, {notificationId: 'n2', state: 'Failed', attempts: [{number: 1, outcome: 'Failed', category: 'Permanent', errorCode: 'CM-ERRORS-EMAILS-005'}]}], hasMore: false}}})
    answers.push({status: 200, body: {list: {items: [{notificationId: 'n3', status: 'Completed'}], hasMore: false}}})
    const {result, error} = await runCommand<{count: number; items: Array<{notificationId: string}>}>(['email', 'notifications', ID, '--state', 'failed', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls.map((c) => c.path)).toEqual([
      `/v3/notifications/email/campaigns/${ID}/batches`,
      `/v3/notifications/emails/campaigns/${ID}/messages`,
      `/v3/notifications/emails/campaigns/${ID}/messages`,
    ])
    expect(result?.count).toBe(1)
    expect(result?.items.map((r) => r.notificationId)).toEqual(['n2'])
    expect(printed.join('\n')).toMatch(/1 failed e-mail recipient of campaign .* \(2 batches\)/)
    expect(printed.join('\n')).toMatch(/n2\s+Failed\s+1 attempt\s+Permanent\s+CM-ERRORS-EMAILS-005/)
  })

  it('labels the hub\'s Completed as Accepted for people and leaves the JSON as sent', async () => {
    answers.push({status: 200, body: {list: {items: [{batchId: 'b1'}], hasMore: false}}})
    answers.push({status: 200, body: {list: {items: [{notificationId: 'n3', status: 'Completed'}], hasMore: false}}})
    const {result, error} = await runCommand<{items: Array<{status: string}>}>(['push', 'notifications', ID, ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls[1]!.path).toBe(`/v3/notifications/push/campaigns/${ID}/messages`)
    expect(printed.join('\n')).toMatch(/n3\s+Accepted/)
    expect(result?.items[0]?.status).toBe('Completed')
    expect(stateLabel('Completed')).toBe('Accepted')
    expect(stateLabel('Cancelled')).toMatch(/^Cancelled/)
  })

  it('follows hasMore / startingAfter pages of the batch list', async () => {
    answers.push({status: 200, body: {list: {items: [{batchId: 'b1'}], hasMore: true, startingAfter: 'b1'}}})
    answers.push({status: 200, body: {list: {items: [{batchId: 'b2'}], hasMore: false}}})
    answers.push({status: 200, body: {list: {items: [], hasMore: false}}})
    answers.push({status: 200, body: {list: {items: [], hasMore: false}}})
    const {result, error} = await runCommand<{batches: number}>(['sms', 'notifications', ID, ...globalArgs])
    expect(error).toBeUndefined()
    expect(result?.batches).toBe(2)
    expect(calls.filter((c) => c.path.endsWith('/batches'))).toHaveLength(2)
  })
})

describe('campaign --stats for people', () => {
  it('shows failedRetryable and cancelled; the JSON output is the hub answer', async () => {
    answers.push({status: 200, body: {stats: {batches: 2, sent: 8, failed: 3, failedRetryable: 2, cancelled: 1, successRate: 72.7}}})
    const {result, error} = await runCommand<{stats: {failedRetryable: number}}>(['email', 'campaign', ID, '--stats', ...globalArgs])
    expect(error).toBeUndefined()
    const text = printed.join('\n')
    expect(text).toMatch(/Accepted:\s+8/)
    expect(text).toMatch(/Failed:\s+3/)
    expect(text).toMatch(/retryable:\s+2/)
    expect(text).toMatch(/Cancelled:\s+1/)
    expect(result?.stats.failedRetryable).toBe(2)
    expect(describeStats({stats: {}})).toMatch(/Success rate:\s+-/)
  })
})

describe('integration save: delivery events and Azure Communication', () => {
  it('email: --provider azureCommunication with endpoint, access key, delivery events and the Event Grid key', async () => {
    const {error} = await runCommand([
      'email', 'integration', 'save', '--provider', 'azureCommunication', '--name', 'Azure', '--from', 'hello@example.com',
      '--endpoint', 'https://r.communication.azure.com', '--access-key', 'ak', '--delivery-events', '--event-grid-key', 'gk', ...globalArgs,
    ])
    expect(error).toBeUndefined()
    const call = calls.find((c) => c.path === '/v3/notifications/email/integrations')!
    expect(call.method).toBe('POST')
    const integration = call.body!.integration as Record<string, unknown>
    expect(integration).toMatchObject({
      provider: 'AzureCommunication',
      endpoint: 'https://r.communication.azure.com',
      accessKey: 'ak',
      deliveryEventsEnabled: true,
      eventGridKey: 'gk',
      emailAddress: 'hello@example.com',
    })
  })

  it('email: AwsSes with --delivery-events --sns-topic-arn; SendGrid with --event-webhook-public-key', async () => {
    await runCommand(['email', 'integration', 'save', '--provider', 'AwsSes', '--from', 'a@b.c', '--delivery-events', '--sns-topic-arn', 'arn:aws:sns:eu-west-1:1:t', ...globalArgs])
    await runCommand(['email', 'integration', 'save', '--provider', 'sendgrid', '--from', 'a@b.c', '--event-webhook-public-key', 'pk', ...globalArgs])
    const [ses, sg] = calls.filter((c) => c.path === '/v3/notifications/email/integrations').map((c) => c.body!.integration as Record<string, unknown>)
    expect(ses).toMatchObject({provider: 'AwsSes', deliveryEventsEnabled: true, snsTopicArn: 'arn:aws:sns:eu-west-1:1:t'})
    expect(sg).toMatchObject({provider: 'SendGrid', eventWebhookPublicKey: 'pk'})
    expect(sg.deliveryEventsEnabled).toBeUndefined()
  })

  it('sms: Twilio with --delivery-events --status-callback-url', async () => {
    const {error} = await runCommand(['sms', 'integration', 'save', '--provider', 'Twilio', '--delivery-events', '--status-callback-url', 'https://hub.example/v3/sms/webhooks/twilio/p/i?env=TEST', ...globalArgs])
    expect(error).toBeUndefined()
    const integration = calls.find((c) => c.path === '/v3/notifications/sms/integrations')!.body!.integration as Record<string, unknown>
    expect(integration).toMatchObject({provider: 'Twilio', deliveryEventsEnabled: true, statusCallbackUrl: 'https://hub.example/v3/sms/webhooks/twilio/p/i?env=TEST'})
  })

  it('--provider still refuses an unknown name', async () => {
    const {error} = await runCommand(['email', 'integration', 'save', '--provider', 'Pigeon', ...globalArgs])
    expect(error?.message).toMatch(/Expected --provider=Pigeon to be one of/)
  })
})

describe('credential version (gateway N-29)', () => {
  it('reads the version from the sign-in answer, top-level or under meta', () => {
    expect(credentialVersionOf({meta: {credentialVersion: 'v-abc'}})).toBe('v-abc')
    expect(credentialVersionOf({credentialVersion: 'v-top'})).toBe('v-top')
    expect(credentialVersionOf({meta: {}})).toBeUndefined()
    expect(credentialVersionOf(undefined)).toBeUndefined()
  })

  it('maps CM-ERRORS-MEMBERSHIP-USERS-050 to the auth exit with the fixed message', () => {
    // The direct-call path: the answer becomes a CliError, then the envelope.
    const env = toEnvelope(
      responseError(401, {responseStatus: {errorCode: CREDENTIALS_CHANGED_CODE, message: 'credentials changed', errors: [{errorCode: CREDENTIALS_CHANGED_CODE, message: 'credentials changed'}]}}, 'http://hub/x'),
    )
    expect(env.exit).toBe(EXIT.AUTH)
    expect(env.code).toBe(CREDENTIALS_CHANGED_CODE)
    expect(env.message).toBe(CREDENTIALS_CHANGED_MESSAGE)
  })
})

describe('built CLI against the fake gateway', () => {
  let gw: FakeGateway
  let home: string

  beforeAll(async () => {
    gw = await startFakeGateway({
      [`/v3/notifications/email/campaigns/${ID}/retry-failed`]: {
        __status: 401,
        responseStatus: {errorCode: CREDENTIALS_CHANGED_CODE, message: 'credentials changed', errors: [{errorCode: CREDENTIALS_CHANGED_CODE, message: 'credentials changed'}]},
      },
      [`/v3/notifications/sms/campaigns/${ID}/retry-failed`]: {retryRequestId: 'rtr_9', selected: 1, skipped: {}, replayed: false},
    })
    home = makeHome(gw.port)
  })

  afterAll(async () => {
    await gw.close()
  })

  it('a 050 answer exits with the auth code and the fixed sentence, in text and in JSON', async () => {
    const text = await cli(home, ['email', 'retry-failed', ID, '--key', 'k', '--profile', 'x'])
    expect(text.code).toBe(EXIT.AUTH)
    expect(text.stderr).toContain(CREDENTIALS_CHANGED_MESSAGE)
    expect(text.stdout).toBe('')

    const json = await cli(home, ['email', 'retry-failed', ID, '--key', 'k', '--profile', 'x', '--json'])
    expect(json.code).toBe(EXIT.AUTH)
    const envelope = parseSingleJson(json.stdout) as {error: {code: string; message: string; exit: number}}
    expect(envelope.error).toMatchObject({code: CREDENTIALS_CHANGED_CODE, message: CREDENTIALS_CHANGED_MESSAGE, exit: EXIT.AUTH})
  })

  it('retry-failed --json prints the hub answer as one document', async () => {
    const res = await cli(home, ['sms', 'retry-failed', ID, '--key', 'k', '--profile', 'x', '--json'])
    expect(res.code).toBe(0)
    expect(parseSingleJson(res.stdout)).toMatchObject({retryRequestId: 'rtr_9', selected: 1})
    const hit = gw.hits.find((h) => h.url.endsWith('/retry-failed'))!
    expect(hit.method).toBe('POST')
    expect(JSON.parse(hit.body)).toEqual({idempotencyKey: 'k'})
  })

  it('whoami shows the credential version a sign-in saved', async () => {
    const sessions = join(home, '.norbix', 'sessions')
    mkdirSync(sessions, {recursive: true})
    const hub = `127.0.0.1_${gw.port}`
    writeFileSync(
      join(sessions, `${hub}@p.json`),
      JSON.stringify({bearerToken: 'tok', method: 'browser', hubUrl: `http://127.0.0.1:${gw.port}`, host: `127.0.0.1:${gw.port}`, projectId: 'p', userName: 'bot', credentialVersion: 'cv-123', savedAt: new Date().toISOString()}),
    )
    const res = await cli(home, ['whoami', '--profile', 'noauth', '--json'])
    expect(res.code).toBe(0)
    const out = parseSingleJson(res.stdout) as {session?: {credentialVersion?: string}}
    expect(out.session?.credentialVersion).toBe('cv-123')
    const text = await cli(home, ['whoami', '--profile', 'noauth'])
    expect(text.stdout).toMatch(/Credential version: cv-123/)
  })
})
