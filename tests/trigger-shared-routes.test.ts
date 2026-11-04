import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {envListAnswer} from './_env.js'
import {formatIdentityCheck, formatPreExecuteTest, formatTriggerAttention} from '../src/lib/triggers.js'

/**
 * The shared trigger routes that are not a module's own — attention,
 * definition, pre-execute-code test, execution-identity check — through oclif
 * and the real `@norbix.ai/ts` transport, `fetch` replaced. The runs routes are
 * in trigger-runs-routes.test.ts.
 */
interface Call {
  method: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

const TRG = 'trg_8d1e0b'

let calls: Call[]
let answer: unknown
let realFetch: typeof globalThis.fetch
let dir: string

beforeEach(() => {
  calls = []
  answer = {}
  dir = mkdtempSync(join(tmpdir(), 'norbix-trigger-shared-'))
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
    return new Response(JSON.stringify(answer), {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  rmSync(dir, {recursive: true, force: true})
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

/** Run a command and return the one request it sent. */
// Note: @oclif/test's runCommand splits argv like a shell (spaces, quotes), so
// no test value here contains a space or a quote.
async function callOf(argv: string[]): Promise<Call> {
  const {error} = await runCommand(['trigger', ...argv, ...globalArgs])
  expect(error).toBeUndefined()
  expect(calls).toHaveLength(1)
  return calls[0]!
}

describe('trigger attention', () => {
  it('reads GET /triggers/attention with the type on the query', async () => {
    answer = {items: [{triggerId: TRG, triggerType: 'Files', reason: 'template misses language de', atUtc: '2026-11-04T10:00:00Z'}]}
    const call = await callOf(['attention', 'Files'])
    expect(call.method).toBe('GET')
    expect(call.path).toBe('/v3/triggers/attention')
    expect(Object.fromEntries(call.query)).toEqual({triggerType: 'Files'})
  })

  it('refuses a trigger type the gateway does not have', async () => {
    const {error} = await runCommand(['trigger', 'attention', 'Webhook', ...globalArgs])
    expect(error?.oclif?.exit).toBe(2)
    expect(calls).toHaveLength(0)
  })
})

describe('trigger definition', () => {
  it('reads GET /triggers/{id}/definition with the type and the schema on the query', async () => {
    answer = {trigger: {type: 'Schema', triggerId: TRG, name: 'On insert', action: {type: 'Email'}}}
    const call = await callOf(['definition', TRG, '--type', 'Schema', '--schema', 'sch_1'])
    expect(call.method).toBe('GET')
    expect(call.path).toBe(`/v3/triggers/${TRG}/definition`)
    expect(Object.fromEntries(call.query)).toEqual({triggerType: 'Schema', schemaId: 'sch_1'})
  })

  it('needs --type', async () => {
    const {error} = await runCommand(['trigger', 'definition', TRG, ...globalArgs])
    expect(error?.oclif?.exit).toBe(2)
    expect(calls).toHaveLength(0)
  })

  it('its --json answer is a file `<module> trigger save` takes as it is (round trip)', async () => {
    // The answer as the Hub sends it and `--json` prints it: the trigger under "trigger".
    answer = {trigger: {type: 'Files', triggerId: TRG, name: 'On upload', when: 'OnFileUploaded', folder: 'invoices', action: {type: 'WebhookCall'}}}
    const {error: readError} = await runCommand(['trigger', 'definition', TRG, '--type', 'Files', '--json', ...globalArgs])
    expect(readError).toBeUndefined()
    const file = join(dir, 'definition.json')
    writeFileSync(file, JSON.stringify(answer))
    calls = []
    const {error} = await runCommand(['files', 'trigger', 'save', '--file', file, ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls[0]!.path).toBe('/v3/files/triggers')
    expect(calls[0]!.body).toEqual({trigger: {type: 'Files', triggerId: TRG, name: 'On upload', when: 'OnFileUploaded', folder: 'invoices', action: {type: 'WebhookCall'}}})
  })
})

describe('trigger pre-execute-test', () => {
  it('posts the code, the type and the sample records as JSON text', async () => {
    answer = {outcome: 'Ran', triggerRuns: true, problems: []}
    const call = await callOf([
      'pre-execute-test', '--type', 'Schema', '--code', 'return(New.status!=null);',
      '--new', '{"status":"published"}', '--old', '{"status":"draft"}', '--event-kind', 'Updated', '--event-name', 'database.record.updated',
    ])
    expect(call.method).toBe('POST')
    expect(call.path).toBe('/v3/triggers/pre-execute-code/test')
    expect(call.body).toEqual({
      code: 'return(New.status!=null);',
      triggerType: 'Schema',
      newRecord: '{"status":"published"}',
      oldRecord: '{"status":"draft"}',
      eventKind: 'Updated',
      eventName: 'database.record.updated',
    })
  })

  it('reads the code from --file and leaves the records out when not given', async () => {
    const file = join(dir, 'guard.cs')
    writeFileSync(file, 'return true;')
    const call = await callOf(['pre-execute-test', '--type', 'Files', '--file', file])
    expect(call.body).toEqual({code: 'return true;', triggerType: 'Files'})
  })

  it('refuses a record that is not JSON, before any call', async () => {
    const {error} = await runCommand(['trigger', 'pre-execute-test', '--type', 'Schema', '--code', 'return(true);', '--new', '{oops', ...globalArgs])
    expect(error?.message).toMatch(/--new is not valid JSON/)
    expect(calls).toHaveLength(0)
  })

  it('needs the code', async () => {
    const {error} = await runCommand(['trigger', 'pre-execute-test', '--type', 'Schema', ...globalArgs])
    expect(error?.message).toMatch(/--code or --file/)
    expect(calls).toHaveLength(0)
  })
})

describe('trigger identity-check', () => {
  it('posts the type, the identity and the action', async () => {
    answer = {executionIdentityId: 'usr_1', isDefault: false, canAssign: true, missingPermissions: ['email:create'], callerMissingPermissions: [], refusals: []}
    const call = await callOf([
      'identity-check', '--type', 'Payments', '--execution-identity', 'usr_1',
      '--action', '{"type":"Email","integrationId":"int_1","templateId":"tpl_1"}',
    ])
    expect(call.method).toBe('POST')
    expect(call.path).toBe('/v3/triggers/execution-identity/check')
    expect(call.body).toEqual({
      triggerType: 'Payments',
      executionIdentityId: 'usr_1',
      action: {type: 'Email', integrationId: 'int_1', templateId: 'tpl_1'},
    })
  })

  it('takes the action from a file and leaves the identity out for the default', async () => {
    const file = join(dir, 'action.json')
    writeFileSync(file, JSON.stringify({type: 'Code', functionRef: {integrationId: 'int_lambda', functionId: 'notify'}}))
    const call = await callOf(['identity-check', '--type', 'Ai', '--action', `@${file}`])
    expect(call.body).toEqual({triggerType: 'Ai', action: {type: 'Code', functionRef: {integrationId: 'int_lambda', functionId: 'notify'}}})
  })
})

describe('formatters', () => {
  it('attention: one line per trigger, the reason last', () => {
    const text = formatTriggerAttention({items: [{triggerId: TRG, triggerType: 'Files', reason: 'template misses language de', atUtc: '2026-11-04T10:00:00Z'}]})
    expect(text.split('\n')[0]).toMatch(/^TRIGGER +TYPE +SINCE +REASON$/)
    expect(text).toContain(`${TRG}  Files  2026-11-04T10:00:00Z  template misses language de`)
    expect(formatTriggerAttention({items: []})).toBe('No trigger needs attention.')
  })

  it('pre-execute test: the outcome and every problem with its place', () => {
    const text = formatPreExecuteTest({outcome: 'CompileError', triggerRuns: false, problems: [{code: 'CS1002', message: '; expected', line: 1, column: 12}]})
    expect(text).toContain('Trigger runs:   no')
    expect(text).toContain('CS1002 (line 1, column 12): ; expected')
  })

  it('identity check: what is missing, or that nothing is', () => {
    expect(formatIdentityCheck({executionIdentityId: 'usr_1', canAssign: true, missingPermissions: ['email:create']})).toContain('Missing:        email:create')
    const ok = formatIdentityCheck({isDefault: true, canAssign: true, missingPermissions: [], refusals: [{errorCode: 'CM-ERRORS-TRIGGERS-030', message: 'not yours'}]})
    expect(ok).toContain('(project default) (default)')
    expect(ok).toContain('nothing — the action can run')
    expect(ok).toContain('Refused:        CM-ERRORS-TRIGGERS-030 not yours')
  })
})
