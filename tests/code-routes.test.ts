import {runCommand} from '@oclif/test'
import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {formatRunInput, formatRuns} from '../src/lib/code.js'

/**
 * Every `norbix code` command, run the way a user types it, through oclif and
 * the real `@norbix.ai/ts` transport, with `fetch` replaced: the verb, the
 * path, the query and the body it sends. Nothing leaves the process; no
 * provider is called by any test.
 */

const INTEGRATION = 'int_6rBACnEaxQ0x1jTiHtAuWV'
const FUNCTION = 'orders-on-update'

interface Call {
  method: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

let calls: Call[]
let realFetch: typeof globalThis.fetch
let answer: unknown

beforeEach(() => {
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
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

const P = '/v3/code/functions'

describe('norbix code functions', () => {
  it('→ GET /code/functions with the integration and the filters in the query', async () => {
    const {error} = await runCommand(['code', 'functions', '--integration', INTEGRATION, '--prefix', 'orders-', '--tag', 'norbix=bookshop', '--page-size', '10', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe(P)
    expect(calls[0]?.query.get('integrationId')).toBe(INTEGRATION)
    expect(calls[0]?.query.get('prefix')).toBe('orders-')
    expect(calls[0]?.query.get('tag')).toBe('norbix=bookshop')
    expect(calls[0]?.query.get('pageSize')).toBe('10')
  })

  it('needs --integration', async () => {
    const {error} = await runCommand(['code', 'functions', ...globalArgs])

    expect(error?.message).toContain('integration')
    expect(calls).toHaveLength(0)
  })
})

describe('norbix code qualifiers', () => {
  it('→ GET /code/functions/qualifiers with the integration and the function', async () => {
    const {error} = await runCommand(['code', 'qualifiers', '--integration', INTEGRATION, '--function', FUNCTION, ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe(`${P}/qualifiers`)
    expect(calls[0]?.query.get('integrationId')).toBe(INTEGRATION)
    expect(calls[0]?.query.get('functionId')).toBe(FUNCTION)
  })
})

describe('norbix code invoke', () => {
  it('→ POST /code/functions/invoke, Sync by default, the payload parsed into data.payload', async () => {
    const {error} = await runCommand([
      'code', 'invoke', '--integration', INTEGRATION, '--function', FUNCTION, '--qualifier', 'prod',
      '--payload', '{"orderId":"6ac54a59212c29912eaddd81","dryRun":true}',
      ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe(`${P}/invoke`)
    expect(calls[0]?.body).toEqual({
      functionRef: {integrationId: INTEGRATION, functionId: FUNCTION, qualifier: 'prod'},
      payload: {orderId: '6ac54a59212c29912eaddd81', dryRun: true},
      invocationType: 'Sync',
    })
  })

  it('--payload-file reads the payload from a file; --async and --run-as go into the body', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'norbix-code-')), 'payload.json')
    writeFileSync(file, '{"batch": 3}')

    const {error} = await runCommand([
      'code', 'invoke', '--integration', INTEGRATION, '--function', 'orders-nightly-payouts',
      '--payload-file', file, '--async', '--run-as', 'usr_2R5So1Lbfc7MNr5lkY522S',
      ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(calls[0]?.body).toEqual({
      functionRef: {integrationId: INTEGRATION, functionId: 'orders-nightly-payouts'},
      payload: {batch: 3},
      invocationType: 'Async',
      runAsUserId: 'usr_2R5So1Lbfc7MNr5lkY522S',
    })
  })

  it('--config @file reads the file and sends its JSON as the envelope config (a string)', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'norbix-code-')), 'config.json')
    writeFileSync(file, '{"acceptStatus": "processing", "imageWidth": 568}')

    const {error} = await runCommand(['code', 'invoke', '--integration', INTEGRATION, '--function', FUNCTION, '--config', `@${file}`, ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.body).toMatchObject({config: '{"acceptStatus":"processing","imageWidth":568}'})

    const bad = await runCommand(['code', 'invoke', '--integration', INTEGRATION, '--function', FUNCTION, '--config', '{nope', ...globalArgs])
    expect(bad.error?.message).toContain('--config is not valid JSON')
    expect(calls).toHaveLength(1)
  })

  it('refuses a payload that is not a JSON object, and both --payload and --payload-file', async () => {
    const notObject = await runCommand(['code', 'invoke', '--integration', INTEGRATION, '--function', FUNCTION, '--payload', '[1,2]', ...globalArgs])
    expect(notObject.error?.message).toContain('JSON object')

    const both = await runCommand(['code', 'invoke', '--integration', INTEGRATION, '--function', FUNCTION, '--payload', '{}', '--payload-file', 'x.json', ...globalArgs])
    expect(both.error?.message).toContain('not both')

    expect(calls).toHaveLength(0)
  })

  it('--dry-run sends nothing', async () => {
    const {error} = await runCommand(['code', 'invoke', '--integration', INTEGRATION, '--function', FUNCTION, '--payload', '{"a":1}', '--dry-run', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
  })
})

describe('norbix code event-sample', () => {
  it('→ GET /code/functions/event-sample with the source in the enum spelling, and prints the envelope alone', async () => {
    answer = {sample: {specVersion: '1', event: 'database.record.updated', source: 'database', data: {}}}

    const {error, result} = await runCommand(['code', 'event-sample', '--source', 'database', '--event', 'database.record.updated', '--schema', 'sch_7lPCzWonEvTQsheGDCaKq', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe(`${P}/event-sample`)
    expect(calls[0]?.query.get('source')).toBe('Database')
    expect(calls[0]?.query.get('event')).toBe('database.record.updated')
    expect(calls[0]?.query.get('schemaId')).toBe('sch_7lPCzWonEvTQsheGDCaKq')
    // The command returns (and prints) the envelope alone, not the response wrapper.
    expect(result).toEqual({specVersion: '1', event: 'database.record.updated', source: 'database', data: {}})
  })

  it('refuses an unknown source', async () => {
    const {error} = await runCommand(['code', 'event-sample', '--source', 'email', ...globalArgs])

    expect(error?.message).toContain('email')
    expect(calls).toHaveLength(0)
  })
})

describe('norbix code runs', () => {
  it('→ GET /code/functions/runs for a trigger', async () => {
    const {error} = await runCommand(['code', 'runs', '--trigger', 'trg_1p4R3gTobGZpD6fXvHT4rd', '--limit', '10', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe(`${P}/runs`)
    expect(calls[0]?.query.get('triggerId')).toBe('trg_1p4R3gTobGZpD6fXvHT4rd')
    expect(calls[0]?.query.get('taskId')).toBeNull()
    expect(calls[0]?.query.get('limit')).toBe('10')
  })

  it('→ GET /code/functions/runs for a task; exactly one of --trigger / --task', async () => {
    const {error} = await runCommand(['code', 'runs', '--task', 'tsk_1', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls[0]?.query.get('taskId')).toBe('tsk_1')

    const neither = await runCommand(['code', 'runs', ...globalArgs])
    expect(neither.error).toBeDefined()
    expect(calls).toHaveLength(1)
  })

  it('returns input as it came (a Fake-provider run: the envelope received, token masked)', async () => {
    answer = {runs: [RUN_WITH_INPUT, RUN_PLAIN]}
    const {error, result} = await runCommand<{runs: Array<{input?: string}>}>(['code', 'runs', '--task', 'tsk_1', ...globalArgs])

    expect(error).toBeUndefined()
    expect(result?.runs[0]?.input).toBe(RUN_WITH_INPUT.input)
    expect(result?.runs[1]?.input).toBeUndefined()
  })
})

const RUN_WITH_INPUT = {
  firedAt: '2026-10-12T09:00:00Z',
  event: 'scheduler.task.fired',
  source: 'scheduler',
  succeeded: true,
  statusCode: 200,
  durationMs: 12,
  input: '{"specVersion":"1","event":"scheduler.task.fired","context":{"runAs":{"accessToken":"***"}}}',
}
const RUN_PLAIN = {firedAt: '2026-10-11T09:00:00Z', event: 'scheduler.task.fired', source: 'scheduler', succeeded: false, error: 'config-not-json'}

describe('code runs output', () => {
  it('prints input as pretty JSON under its row, the row without it', () => {
    const text = formatRuns({runs: [RUN_WITH_INPUT, RUN_PLAIN]})
    const [first, second] = text.split('\n\n')

    expect(first).toContain('"durationMs": 12')
    expect(first).toContain('\ninput:\n')
    expect(first).toContain('  "accessToken": "***"')
    expect(first).not.toContain('"input":')
    expect(second).toBe(JSON.stringify(RUN_PLAIN, null, 2))
    expect(second).not.toContain('input:')
  })

  it('prints the answer as it is when no run carries input', () => {
    const res = {runs: [RUN_PLAIN]}
    expect(formatRuns(res)).toBe(JSON.stringify(res, null, 2))
    expect(formatRuns({runs: []})).toBe(JSON.stringify({runs: []}, null, 2))
  })

  it('leaves an input the 64 KB cut broke as it came', () => {
    const cut = '{"specVersion":"1","event":"database.record.updated","data":{"database":{"new":{"na'
    expect(formatRunInput(cut)).toBe(cut)
    expect(formatRunInput('{"a":1}')).toBe('{\n  "a": 1\n}')
  })
})
