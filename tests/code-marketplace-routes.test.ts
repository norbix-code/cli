import {runCommand} from '@oclif/test'
import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'


import {formatValidation, functionsGate, parseInputs, parseKeyValues, readArguments} from '../src/lib/marketplace.js'

/**
 * Every `norbix code marketplace` command, run the way a user types it,
 * through oclif and the real `@norbix.ai/ts` transport, with `fetch`
 * replaced: the verb, the path, the query and the body it sends. Nothing
 * leaves the process; no vendor is called by any test.
 */

const LISTING = 'ml_norbix_database_v1'
const CONNECTION = 'int_6rBACnEaxQ0x1jTiHtAuWV'
const FUNCTION = 'func_4hT8rW2nQ6xLmP0vZ3kJ1c'

interface Call {
  method: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

let calls: Call[]
let realFetch: typeof globalThis.fetch
let answer: unknown
/** What the command printed (oclif's log ends in console.log under vitest), joined by newlines. */
let printed: string[]
const out = () => printed.join('\n')

beforeEach(() => {
  printed = []
  vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
    printed.push(parts.join(' '))
  })
  calls = []
  answer = {ok: true}
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push({
      method: init?.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
    })
    return new Response(JSON.stringify(answer), {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

const M = '/v3/code/marketplace'
const C = `${M}/integrations`

describe('norbix code marketplace listings', () => {
  it('→ GET /code/marketplace/listings with search, every tag, category and transport in the query', async () => {
    const {error} = await runCommand([
      'code', 'marketplace', 'listings', '--search', 'slack', '--tags', 'chat', '--tags', 'official',
      '--category', 'Communication', '--transport', 'Rest', '--official', '--page-size', '10', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe(`${M}/listings`)
    expect(calls[0]?.query.get('search')).toBe('slack')
    expect(calls[0]?.query.getAll('tags')).toEqual(['chat', 'official'])
    expect(calls[0]?.query.getAll('categories')).toEqual(['Communication'])
    expect(calls[0]?.query.getAll('transports')).toEqual(['Rest'])
    expect(calls[0]?.query.get('officialOnly')).toBe('true')
    expect(calls[0]?.query.get('pageSize')).toBe('10')
  })

  it('with a listing ID → GET /code/marketplace/listings/{id} (install form, steps, functions)', async () => {
    const {error} = await runCommand(['code', 'marketplace', 'listings', LISTING, ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe(`${M}/listings/${LISTING}`)
  })

  it('refuses an unknown category', async () => {
    const {error} = await runCommand(['code', 'marketplace', 'listings', '--category', 'Games', ...globalArgs])

    expect(error?.message).toContain('Games')
    expect(calls).toHaveLength(0)
  })
})

describe('norbix code marketplace connections', () => {
  it('list → GET /code/marketplace/integrations', async () => {
    const {error} = await runCommand(['code', 'marketplace', 'connections', 'list', '--page-size', '5', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe(C)
    expect(calls[0]?.query.get('pageSize')).toBe('5')
  })

  it('get → GET /code/marketplace/integrations/{id}', async () => {
    const {error} = await runCommand(['code', 'marketplace', 'connections', 'get', CONNECTION, ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe(`${C}/${CONNECTION}`)
  })

  it('enable --listing → POST /code/marketplace/integrations without an id, config and secrets as bags; prints the minted id', async () => {
    answer = {id: CONNECTION}
    const {error, result} = await runCommand<{id: string}>([
      'code', 'marketplace', 'connections', 'enable', '--listing', 'ml_slack_v1', '--name', 'Slack-support',
      '--config', 'baseUrl=https://slack.com/api', '--secret', 'botToken=xoxb-1=2', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe(C)
    expect(calls[0]?.body).toEqual({
      integration: {listingViewId: 'ml_slack_v1', integrationName: 'Slack-support', isEnabled: true, config: {baseUrl: 'https://slack.com/api'}},
      secrets: {botToken: 'xoxb-1=2'},
    })
    expect(result?.id).toBe(CONNECTION)
    expect(out()).toContain(`Connection ${CONNECTION} created.`)
    expect(out()).toContain(`connections validate ${CONNECTION}`)
    expect(out()).not.toContain('xoxb')
  })

  it('enable --listing without --name names the connection after the listing (one GET first)', async () => {
    answer = {listing: {displayName: 'Norbix Database'}, id: CONNECTION}
    const {error} = await runCommand(['code', 'marketplace', 'connections', 'enable', '--listing', LISTING, ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`GET ${M}/listings/${LISTING}`, `POST ${C}`])
    expect(calls[1]?.body).toEqual({
      integration: {listingViewId: LISTING, integrationName: 'Norbix Database', isEnabled: true, config: {}},
      secrets: {},
    })
  })

  it('enable --listing --id saves an existing connection again (viewId sent)', async () => {
    const {error} = await runCommand(['code', 'marketplace', 'connections', 'enable', '--listing', LISTING, '--name', 'DB', '--id', CONNECTION, ...globalArgs])

    expect(error).toBeUndefined()
    expect((calls[0]?.body?.integration as {viewId?: string}).viewId).toBe(CONNECTION)
  })

  it('enable <id> → POST /code/marketplace/integrations/{id}/enable (turn it back on)', async () => {
    const {error} = await runCommand(['code', 'marketplace', 'connections', 'enable', CONNECTION, ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe(`${C}/${CONNECTION}/enable`)
  })

  it('enable needs exactly one of --listing / a connection ID, and key=value pairs', async () => {
    const neither = await runCommand(['code', 'marketplace', 'connections', 'enable', ...globalArgs])
    expect(neither.error?.message).toContain('either --listing')

    const both = await runCommand(['code', 'marketplace', 'connections', 'enable', CONNECTION, '--listing', LISTING, ...globalArgs])
    expect(both.error?.message).toContain('either --listing')

    const bad = await runCommand(['code', 'marketplace', 'connections', 'enable', '--listing', LISTING, '--name', 'x', '--config', 'novalue', ...globalArgs])
    expect(bad.error?.message).toContain('key=value')

    expect(calls).toHaveLength(0)
  })

  it('enable --listing --dry-run sends nothing (and does not look the listing up)', async () => {
    const {error} = await runCommand(['code', 'marketplace', 'connections', 'enable', '--listing', LISTING, '--dry-run', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
  })

  it('disable → POST …/{id}/disable; delete → DELETE …/{id}; both need --yes in a script', async () => {
    const refused = await runCommand(['code', 'marketplace', 'connections', 'delete', CONNECTION, ...globalArgs])
    expect(refused.error?.message).toContain('Confirmation required')
    expect(calls).toHaveLength(0)

    const disable = await runCommand(['code', 'marketplace', 'connections', 'disable', CONNECTION, '--yes', ...globalArgs])
    expect(disable.error).toBeUndefined()
    const del = await runCommand(['code', 'marketplace', 'connections', 'delete', CONNECTION, '--yes', ...globalArgs])
    expect(del.error).toBeUndefined()

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`POST ${C}/${CONNECTION}/disable`, `DELETE ${C}/${CONNECTION}`])
  })

  it('validate → POST …/{id}/test, prints each step and the add-functions gate', async () => {
    answer = {steps: [STEP_OK, STEP_FAILED, STEP_SKIPPED]}
    const {error} = await runCommand(['code', 'marketplace', 'connections', 'validate', CONNECTION, ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe(`${C}/${CONNECTION}/test`)
    expect(out()).toContain('ok      secrets.present  Secrets saved (required)')
    expect(out()).toContain('failed  slack.auth  Slack accepts the token (required) — invalid_auth')
    expect(out()).toContain('Functions: blocked until these required steps pass: slack.auth.')
  })

  it('validate --json returns the answer as it came', async () => {
    answer = {steps: [STEP_OK]}
    const {result} = await runCommand(['code', 'marketplace', 'connections', 'validate', CONNECTION, '--json', ...globalArgs])

    expect(result).toEqual({steps: [STEP_OK]})
  })

  it('secrets set → PUT …/{id}/secrets with the whole bag; the values are not printed', async () => {
    const {error} = await runCommand([
      'code', 'marketplace', 'connections', 'secrets', 'set', CONNECTION, '--secret', 'botToken=xoxb-9', '--secret', 'signingSecret=s3', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(calls[0]?.method).toBe('PUT')
    expect(calls[0]?.path).toBe(`${C}/${CONNECTION}/secrets`)
    expect(calls[0]?.body).toEqual({secrets: {botToken: 'xoxb-9', signingSecret: 's3'}})
    expect(out()).toContain('botToken, signingSecret')
    expect(out()).not.toContain('xoxb-9')
  })

  it('secrets set needs --secret', async () => {
    const {error} = await runCommand(['code', 'marketplace', 'connections', 'secrets', 'set', CONNECTION, ...globalArgs])

    expect(error?.message).toContain('secret')
    expect(calls).toHaveLength(0)
  })
})

describe('norbix code marketplace functions', () => {
  const F = `${C}/${CONNECTION}/functions`

  it('list → GET …/integrations/{id}/functions', async () => {
    const {error} = await runCommand(['code', 'marketplace', 'functions', 'list', '--connection', CONNECTION, ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe(F)
  })

  it('get → GET …/functions/{func}', async () => {
    const {error} = await runCommand(['code', 'marketplace', 'functions', 'get', FUNCTION, '--connection', CONNECTION, ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.path).toBe(`${F}/${FUNCTION}`)
  })

  it('add → POST …/functions without an id; JSON arguments become strings, declared inputs go along', async () => {
    answer = {id: FUNCTION}
    const {error} = await runCommand([
      'code', 'marketplace', 'functions', 'add', '--connection', CONNECTION, '--key', 'db.find', '--name', 'Paid-orders',
      '--arguments', '{"collection":"orders","filter":{"status":"paid","customerId":"@Model.Request.customerId"},"pageSize":20}',
      '--input', 'customerId:string:required', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe(F)
    expect(calls[0]?.body).toEqual({
      function: {
        integrationViewId: CONNECTION,
        functionKey: 'db.find',
        displayName: 'Paid-orders',
        isEnabled: true,
        arguments: {collection: 'orders', filter: '{"status":"paid","customerId":"@Model.Request.customerId"}', pageSize: '20'},
        inputs: [{name: 'customerId', type: 'string', isRequired: true}],
      },
    })
    expect(out()).toContain(`Function ${FUNCTION} added.`)
  })

  it('add --arg key=value (wins over --arguments), @file arguments, --disabled, name defaults to the key', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'norbix-mkt-')), 'args.json')
    writeFileSync(file, '{"channel":"C0123","text":"old"}')

    const {error} = await runCommand([
      'code', 'marketplace', 'functions', 'add', '--connection', CONNECTION, '--key', 'chat.postMessage',
      '--arguments', `@${file}`, '--arg', 'text=Order:@Model.Request.orderNo', '--input', 'orderNo', '--disabled', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(calls[0]?.body?.function).toEqual({
      integrationViewId: CONNECTION,
      functionKey: 'chat.postMessage',
      displayName: 'chat.postMessage',
      isEnabled: false,
      arguments: {channel: 'C0123', text: 'Order:@Model.Request.orderNo'},
      inputs: [{name: 'orderNo', type: 'string', isRequired: false}],
    })
  })

  it('add refuses arguments that are not a JSON object and a bad --input', async () => {
    const notObject = await runCommand(['code', 'marketplace', 'functions', 'add', '--connection', CONNECTION, '--key', 'db.find', '--arguments', '[1]', ...globalArgs])
    expect(notObject.error?.message).toContain('JSON object')

    const badInput = await runCommand(['code', 'marketplace', 'functions', 'add', '--connection', CONNECTION, '--key', 'db.find', '--input', 'x:date', ...globalArgs])
    expect(badInput.error?.message).toContain('name[:type[:required]]')

    expect(calls).toHaveLength(0)
  })

  it('enable → POST …/{func}/enable; disable / delete need --yes', async () => {
    await runCommand(['code', 'marketplace', 'functions', 'enable', FUNCTION, '--connection', CONNECTION, ...globalArgs])
    await runCommand(['code', 'marketplace', 'functions', 'disable', FUNCTION, '--connection', CONNECTION, '--yes', ...globalArgs])
    await runCommand(['code', 'marketplace', 'functions', 'delete', FUNCTION, '--connection', CONNECTION, '--yes', ...globalArgs])
    const refused = await runCommand(['code', 'marketplace', 'functions', 'delete', FUNCTION, '--connection', CONNECTION, ...globalArgs])

    expect(refused.error?.message).toContain('Confirmation required')
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      `POST ${F}/${FUNCTION}/enable`,
      `POST ${F}/${FUNCTION}/disable`,
      `DELETE ${F}/${FUNCTION}`,
    ])
  })

  it('invoke → POST /code/marketplace/functions/{func}/invoke with the payload', async () => {
    answer = {isSuccess: true, output: {items: []}, vendorRequestId: 'req-1'}
    const {error, result} = await runCommand(['code', 'marketplace', 'functions', 'invoke', FUNCTION, '--payload', '{"customerId":"6ac5"}', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe(`${M}/functions/${FUNCTION}/invoke`)
    expect(calls[0]?.body).toEqual({payload: {customerId: '6ac5'}})
    expect(result).toEqual({isSuccess: true, output: {items: []}, vendorRequestId: 'req-1'})
  })

  it('invoke without a payload sends an empty object; a non-object payload is refused', async () => {
    await runCommand(['code', 'marketplace', 'functions', 'invoke', FUNCTION, ...globalArgs])
    expect(calls[0]?.body).toEqual({payload: {}})

    const bad = await runCommand(['code', 'marketplace', 'functions', 'invoke', FUNCTION, '--payload', '[1]', ...globalArgs])
    expect(bad.error?.message).toContain('JSON object')
    expect(calls).toHaveLength(1)
  })
})

describe('norbix code marketplace runs', () => {
  it('→ GET /code/marketplace/functions/runs for a trigger', async () => {
    const {error} = await runCommand(['code', 'marketplace', 'runs', '--trigger', 'trg_1p4R3gTobGZpD6fXvHT4rd', '--limit', '10', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe(`${M}/functions/runs`)
    expect(calls[0]?.query.get('triggerId')).toBe('trg_1p4R3gTobGZpD6fXvHT4rd')
    expect(calls[0]?.query.get('taskId')).toBeNull()
    expect(calls[0]?.query.get('limit')).toBe('10')
  })

  it('for a task; exactly one of --trigger / --task; a Fake-vendor input printed under its row', async () => {
    answer = {runs: [{firedAt: '2026-10-12T09:00:00Z', event: 'scheduler.task.fired', functionId: FUNCTION, succeeded: true, input: '{"headers":{"X-Api-Key":"***"}}'}]}
    const {error} = await runCommand(['code', 'marketplace', 'runs', '--task', 'tsk_1', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls[0]?.query.get('taskId')).toBe('tsk_1')
    expect(out()).toContain('\ninput:\n')
    expect(out()).toContain('"X-Api-Key": "***"')

    const neither = await runCommand(['code', 'marketplace', 'runs', ...globalArgs])
    expect(neither.error).toBeDefined()
    expect(calls).toHaveLength(1)
  })

  it('→ GET /code/marketplace/functions/runs for a function: only functionId and limit on the query, no body', async () => {
    const {error} = await runCommand(['code', 'marketplace', 'runs', '--function', FUNCTION, '--limit', '50', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe(`${M}/functions/runs`)
    expect(Object.fromEntries([...calls[0]!.query.entries()].filter(([k]) => k !== 'env'))).toEqual({functionId: FUNCTION, limit: '50'})
    expect(calls[0]?.body).toBeUndefined()

    const two = await runCommand(['code', 'marketplace', 'runs', '--function', FUNCTION, '--trigger', 'trg_1', ...globalArgs])
    expect(two.error).toBeDefined()
    expect(calls).toHaveLength(1)
  })

  it('--details reads the log lines of a run with hasDetails by targetCorrelationId; a run without says the logs must be on', async () => {
    const CORRELATION = '0f8e2c9a4b7d4e1f9a3c5b6d7e8f9012'
    const runs = {
      runs: [
        {firedAt: '2026-10-13T08:01:00Z', event: 'invoke', source: 'api-key', functionId: FUNCTION, succeeded: true, status: 'ok', durationMs: 42, correlationId: CORRELATION, hasDetails: true},
        {firedAt: '2026-10-13T08:00:00Z', event: 'invoke', source: 'user', functionId: FUNCTION, succeeded: true, status: 'ok', durationMs: 40, correlationId: 'aa11bb22cc33dd44ee55ff6677889900', hasDetails: false},
      ],
    }
    const lines = {
      items: [
        {timestamp: '2026-10-13T08:01:00.010Z', level: 'Information', eventCode: 'marketplace:run:started', title: 'Marketplace function run started', meta: {input: '{"text":"hi"}'}},
        {timestamp: '2026-10-13T08:01:00.052Z', level: 'Information', eventCode: 'marketplace:run:completed', title: 'Marketplace function run completed', meta: {durationMs: '42'}},
      ],
    }
    const realFake = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      answer = url.pathname.endsWith('/logs/audit') ? lines : runs
      return realFake(input, init)
    }) as typeof globalThis.fetch

    const {error} = await runCommand(['code', 'marketplace', 'runs', '--function', FUNCTION, '--details', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /v3/code/marketplace/functions/runs', 'GET /v3/logs/audit'])
    expect(Object.fromEntries([...calls[1]!.query.entries()].filter(([k]) => k !== 'env'))).toEqual({targetCorrelationId: CORRELATION})
    expect(calls[1]?.body).toBeUndefined()
    expect(out()).toContain('marketplace:run:started  Marketplace function run started')
    expect(out()).toContain('"input": "{\\"text\\":\\"hi\\"}"')
    expect(out()).toContain("details: details need the project's logs on")
  })

  it('--details --json: each row gains details (the lines, or null with detailsNote)', async () => {
    answer = {runs: [{firedAt: '2026-10-13T08:00:00Z', event: 'invoke', source: 'ai', functionId: FUNCTION, succeeded: false, status: 'failed', hasDetails: false}]}
    const {error, result} = await runCommand(['code', 'marketplace', 'runs', '--function', FUNCTION, '--details', '--json', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(result).toEqual({
      runs: [{firedAt: '2026-10-13T08:00:00Z', event: 'invoke', source: 'ai', functionId: FUNCTION, succeeded: false, status: 'failed', hasDetails: false, details: null, detailsNote: "details need the project's logs on"}],
    })
  })
})

const STEP_OK = {key: 'secrets.present', label: 'Secrets saved', requiredForFunctions: true, succeeded: true, skipped: false}
const STEP_FAILED = {key: 'slack.auth', label: 'Slack accepts the token', requiredForFunctions: true, succeeded: false, skipped: false, message: 'invalid_auth'}
const STEP_SKIPPED = {key: 'web.fetch', label: 'Fetch a page', requiredForFunctions: false, succeeded: false, skipped: true, message: "the required step 'slack.auth' failed"}

describe('marketplace helpers', () => {
  it('functionsGate: open only when every required step ran green', () => {
    expect(functionsGate({steps: [STEP_OK]})).toEqual({open: true, blocking: []})
    expect(functionsGate({steps: [STEP_OK, STEP_FAILED, STEP_SKIPPED]})).toEqual({open: false, blocking: ['slack.auth']})
    // A required step that was skipped (no runner, earlier failure) keeps the gate shut.
    expect(functionsGate({steps: [{...STEP_OK, skipped: true}]})).toEqual({open: false, blocking: ['secrets.present']})
    // Not-required failures never gate.
    expect(functionsGate({steps: [{...STEP_FAILED, requiredForFunctions: false}]}).open).toBe(true)
  })

  it('formatValidation: one line per step, then the gate; a Hub without steps prints the answer and says so', () => {
    expect(formatValidation({steps: [STEP_OK]})).toBe('ok      secrets.present  Secrets saved (required)\n\nFunctions: can be added.')
    expect(formatValidation({steps: [STEP_SKIPPED]})).toContain("skipped web.fetch  Fetch a page — the required step 'slack.auth' failed")
    expect(formatValidation({items: []})).toContain('This Hub reported no validation steps.')
  })

  it('parseKeyValues splits at the first =', () => {
    expect(parseKeyValues(['a=1', 'b=x=y', 'c='], 'config')).toEqual({a: '1', b: 'x=y', c: ''})
    expect(parseKeyValues(undefined, 'config')).toBeUndefined()
    expect(() => parseKeyValues(['=1'], 'config')).toThrow('key=value')
  })

  it('readArguments: JSON values become their JSON text, nulls are dropped, --arg wins', async () => {
    await expect(readArguments({arguments: '{"a":"x","b":true,"c":[1],"d":null}', arg: ['a=y']})).resolves.toEqual({a: 'y', b: 'true', c: '[1]'})
    await expect(readArguments({})).resolves.toBeUndefined()
  })

  it('parseInputs: name[:type[:required]]', () => {
    expect(parseInputs(['a', 'b:number', 'c:object:required'])).toEqual([
      {name: 'a', type: 'string', isRequired: false},
      {name: 'b', type: 'number', isRequired: false},
      {name: 'c', type: 'object', isRequired: true},
    ])
    expect(() => parseInputs(['a:string:optional'])).toThrow('name[:type[:required]]')
    expect(() => parseInputs([':string'])).toThrow('name[:type[:required]]')
  })
})
