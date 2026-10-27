import {runCommand} from '@oclif/test'
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {parse as parseYaml} from 'yaml'

import {BETA_NOTE, formatIssue, formatOf, formatRun, formatValidation} from '../src/lib/workflows.js'
import {envListAnswer} from './_env.js'

/**
 * Every `norbix code workflows` command (Workflows beta), run the way a user
 * types it, through oclif and the real `@norbix.ai/ts` transport, with `fetch`
 * replaced: the verb, the path, the query and the body it sends. Nothing
 * leaves the process.
 */

const WF = 'wf_3kQ9mZ2vXc8LpR4wT7yH1n'
const RUN = 'wfr_5nB2xQ7wLk9RmT3vYc1HdP'

const DEFINITION = {
  schemaVersion: '1',
  name: 'Approve big orders',
  executionIdentityId: 'usr_2R5So1Lbfc7MNr5lkY522S',
  isEnabled: true,
  inputs: {type: 'object', properties: {orderId: {type: 'string'}}, required: ['orderId']},
  steps: [
    {id: 'load', kind: 'database.findOne', config: {collection: 'orders', filter: {_id: '@Model.Request.orderId'}}},
    {id: 'approve', kind: 'wait', wait: {kind: 'approval', assignees: ['usr_2R5So1Lbfc7MNr5lkY522S'], key: 'order-@Model.Request.orderId'}},
    {id: 'notify', kind: 'email.send', action: {templateId: 'tmpl_6kbXOl8AX1HdVMyFwURznj'}},
  ],
}

const DEFINITION_YAML = `schemaVersion: "1"
name: Approve big orders
executionIdentityId: usr_2R5So1Lbfc7MNr5lkY522S
isEnabled: true
inputs:
  type: object
  properties:
    orderId:
      type: string
  required: [orderId]
steps:
  - id: load
    kind: database.findOne
    config:
      collection: orders
      filter:
        _id: "@Model.Request.orderId"
  - id: approve
    kind: wait
    wait:
      kind: approval
      assignees: [usr_2R5So1Lbfc7MNr5lkY522S]
      key: order-@Model.Request.orderId
  - id: notify
    kind: email.send
    action:
      templateId: tmpl_6kbXOl8AX1HdVMyFwURznj
`

const WORKFLOW = {
  workflow: {
    workflowId: WF,
    env: 'PROD',
    definition: {...DEFINITION, workflowId: WF, version: 2},
    version: 2,
    isPublished: true,
    hasDraft: false,
    isEnabled: true,
    createdAt: '2026-10-20T08:00:00Z',
    updatedAt: '2026-10-27T08:00:00Z',
    versions: [],
    warnings: [{code: 'CM-ERRORS-WORKFLOWS-033', message: 'The output of step "load" is not known', stepId: 'notify', path: 'steps[2].action'}],
  },
}

const RUN_DTO = {
  runId: RUN,
  workflowId: WF,
  version: 2,
  isDraft: false,
  status: 'succeeded',
  source: 'invoke',
  depth: 0,
  env: 'PROD',
  startedAt: '2026-10-27T08:00:00Z',
  finishedAt: '2026-10-27T08:00:03Z',
  durationMs: 3012,
  waitingOn: [],
  stepRuns: 3,
  output: {sent: true},
  steps: [
    {stepId: 'load', kind: 'database.findOne', status: 'succeeded', attempt: 1, pass: 1, durationMs: 12, inputTruncated: false, outputTruncated: false},
    {stepId: 'approve', kind: 'wait', status: 'succeeded', attempt: 1, pass: 1, durationMs: 2900, decision: 'approved', inputTruncated: false, outputTruncated: false},
    {stepId: 'notify', kind: 'email.send', status: 'succeeded', attempt: 2, pass: 1, durationMs: 100, inputTruncated: false, outputTruncated: false},
  ],
}

interface Call {
  method: string
  host: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
  env: string | null
}

interface Answer {
  status?: number
  body: unknown
}

let calls: Call[]
let realFetch: typeof globalThis.fetch
/** Answered in order, one per call; when empty, `answer`. */
let queue: Answer[]
let answer: unknown
let environments: string[]
let printed: string[]
const out = () => printed.join('\n')

beforeEach(() => {
  printed = []
  vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
    printed.push(parts.join(' '))
  })
  calls = []
  queue = []
  answer = {ok: true}
  environments = ['PROD']
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const envList = envListAnswer(input, init, environments)
    if (envList) return envList
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push({
      method: init?.method ?? 'GET',
      host: url.host,
      path: url.pathname,
      query: url.searchParams,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
      env: new Headers(init?.headers).get('norbix-env'),
    })
    const next = queue.shift() ?? {body: answer}
    return new Response(JSON.stringify(next.body), {status: next.status ?? 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

const W = '/v3/code/workflows'

function tempFile(name: string, text: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'norbix-wf-')), name)
  writeFileSync(path, text)
  return path
}

const wf = (...args: string[]) => runCommand(['code', 'workflows', ...args, ...globalArgs])

describe('norbix code workflows — the topic', () => {
  it('says once in the topic help that workflows are in beta', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      oclif: {topics: {code: {subtopics: {workflows: {description: string}}}}}
    }
    expect(pkg.oclif.topics.code.subtopics.workflows.description).toContain(BETA_NOTE)
  })
})

describe('norbix code workflows — definitions', () => {
  it('list → GET /code/workflows with isEnabled and the page', async () => {
    const {error} = await wf('list', '--disabled', '--limit', '50', '--after', 'wf_a')

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({method: 'GET', path: W})
    expect(calls[0]?.query.get('isEnabled')).toBe('false')
    expect(calls[0]?.query.get('pageSize')).toBe('50')
    expect(calls[0]?.query.get('startingAfter')).toBe('wf_a')
  })

  it('list --enabled → isEnabled=true; --enabled with --disabled is refused', async () => {
    await wf('list', '--enabled')
    expect(calls[0]?.query.get('isEnabled')).toBe('true')

    calls = []
    const {error} = await wf('list', '--enabled', '--disabled')
    expect(error?.message).toMatch(/cannot also be provided/)
    expect(calls).toHaveLength(0)
  })

  it('get → GET /code/workflows/{id} with pinnedVersion', async () => {
    answer = WORKFLOW
    const {error} = await wf('get', WF, '--version', '2')

    expect(error).toBeUndefined()
    expect(calls[0]).toMatchObject({method: 'GET', path: `${W}/${WF}`})
    expect(calls[0]?.query.get('pinnedVersion')).toBe('2')
    expect(JSON.parse(out())).toEqual(WORKFLOW)
  })

  it('get --format yaml prints the definition alone, and it parses back to the same object', async () => {
    answer = WORKFLOW
    const {error} = await wf('get', WF, '--format', 'yaml')

    expect(error).toBeUndefined()
    expect(calls[0]?.query.has('pinnedVersion')).toBe(false)
    expect(out()).toContain('name: Approve big orders')
    expect(parseYaml(out())).toEqual(WORKFLOW.workflow.definition)
  })

  it('save --file flow.yaml → PUT /code/workflows with the YAML as the JSON definition', async () => {
    answer = WORKFLOW
    const {error} = await wf('save', '--file', tempFile('flow.yaml', DEFINITION_YAML))

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({method: 'PUT', path: W})
    expect(calls[0]?.body).toEqual({definition: DEFINITION})
    expect(out()).toContain(`Workflow ${WF} (Approve big orders) saved (draft).`)
    expect(out()).toContain('CM-ERRORS-WORKFLOWS-033  step "notify": The output of step "load" is not known (steps[2].action)')
  })

  it('save --file flow.json with workflowId sends it as it is (updates the draft)', async () => {
    const withId = {...DEFINITION, workflowId: WF}
    await wf('save', '--file', tempFile('flow.json', JSON.stringify(withId)))

    expect(calls[0]?.body).toEqual({definition: withId})
  })

  it('save refuses a file that is not one object and sends nothing', async () => {
    const {error} = await wf('save', '--file', tempFile('flow.yaml', '- one\n- two\n'))

    expect(error?.message).toMatch(/must be one object/)
    expect(calls).toHaveLength(0)
  })

  it('save --dry-run sends nothing', async () => {
    const {error} = await wf('save', '--file', tempFile('flow.yaml', DEFINITION_YAML), '--dry-run')

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
    expect(out()).toContain('Would call: hub.code.saveCodeWorkflow')
  })

  it('save --env TEST sends the norbix-env header', async () => {
    environments = ['PROD', 'TEST']
    const {error} = await runCommand(['code', 'workflows', 'save', '--file', tempFile('flow.yaml', DEFINITION_YAML), '--env', 'TEST', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.env).toBe('TEST')
  })

  it('validate --file flow.yaml → POST /code/workflows/validate with the JSON definition; valid exits 0', async () => {
    answer = {isValid: true, errors: [], warnings: []}
    const {error} = await wf('validate', '--file', tempFile('flow.yaml', DEFINITION_YAML))

    expect(error).toBeUndefined()
    expect(calls[0]).toMatchObject({method: 'POST', path: `${W}/validate`})
    expect(calls[0]?.body).toEqual({definition: DEFINITION})
    expect(out()).toBe('Valid.')
  })

  it('validate prints the errors and warnings and exits 6 when it is not valid', async () => {
    answer = {
      isValid: false,
      errors: [{code: 'CM-ERRORS-WORKFLOWS-005', message: 'Unknown step "nope" in next', stepId: 'load', path: 'steps[0].next', line: 9, column: 5}],
      warnings: [{code: 'CM-ERRORS-WORKFLOWS-028', message: 'No limits set'}],
    }
    const {error} = await wf('validate', '--file', tempFile('flow.yaml', DEFINITION_YAML))

    expect(error?.oclif?.exit).toBe(6)
    expect(out()).toContain('NOT valid — 1 error, 1 warning.')
    expect(out()).toContain('CM-ERRORS-WORKFLOWS-005  step "load": Unknown step "nope" in next (steps[0].next, line 9:5)')
    expect(out()).toContain('CM-ERRORS-WORKFLOWS-028  No limits set')
  })

  it('validate --json prints the answer once and still exits 6 when it is not valid', async () => {
    answer = {isValid: false, errors: [{code: 'CM-ERRORS-WORKFLOWS-001', message: 'x'}], warnings: []}
    const {error} = await wf('validate', '--file', tempFile('flow.json', JSON.stringify(DEFINITION)), '--json')

    expect(error?.oclif?.exit).toBe(6)
    expect(JSON.parse(out())).toEqual(answer)
  })

  it('publish → POST /code/workflows/{id}/publish; refuses without --yes, sends nothing with --dry-run', async () => {
    const refused = await wf('publish', WF)
    expect((refused.error as {code?: string} | undefined)?.code).toBe('CONFIRMATION_REQUIRED')
    expect(calls).toHaveLength(0)

    await wf('publish', WF, '--dry-run')
    expect(calls).toHaveLength(0)

    answer = WORKFLOW
    const {error} = await wf('publish', WF, '--yes')
    expect(error).toBeUndefined()
    expect(calls[0]).toMatchObject({method: 'POST', path: `${W}/${WF}/publish`})
    expect(out()).toContain('published.')
  })

  it('draft → GET /code/workflows/{id}/draft; --format yaml prints the draft definition', async () => {
    answer = WORKFLOW
    await wf('draft', WF, '--format', 'yaml')

    expect(calls[0]).toMatchObject({method: 'GET', path: `${W}/${WF}/draft`})
    expect(parseYaml(out())).toEqual(WORKFLOW.workflow.definition)
  })

  it('draft --discard → DELETE /code/workflows/{id}/draft, and only with --yes', async () => {
    const refused = await wf('draft', WF, '--discard')
    expect((refused.error as {code?: string} | undefined)?.code).toBe('CONFIRMATION_REQUIRED')
    expect(calls).toHaveLength(0)

    const {error} = await wf('draft', WF, '--discard', '--yes')
    expect(error).toBeUndefined()
    expect(calls[0]).toMatchObject({method: 'DELETE', path: `${W}/${WF}/draft`})
  })

  it('versions → GET /code/workflows/{id}/versions', async () => {
    await wf('versions', WF)

    expect(calls[0]).toMatchObject({method: 'GET', path: `${W}/${WF}/versions`})
  })

  it('diff → GET /code/workflows/{id}/versions/diff with fromVersion and toVersion', async () => {
    await wf('diff', WF, '--from', '1', '--to', '2')

    expect(calls[0]).toMatchObject({method: 'GET', path: `${W}/${WF}/versions/diff`})
    expect(calls[0]?.query.get('fromVersion')).toBe('1')
    expect(calls[0]?.query.get('toVersion')).toBe('2')
  })

  it('delete → DELETE /code/workflows/{id}, only with --yes', async () => {
    const refused = await wf('delete', WF)
    expect((refused.error as {code?: string} | undefined)?.code).toBe('CONFIRMATION_REQUIRED')
    expect(calls).toHaveLength(0)

    await wf('delete', WF, '--yes')
    expect(calls[0]).toMatchObject({method: 'DELETE', path: `${W}/${WF}`})
  })

  it('enable → PUT /code/workflows/{id}/enable; disable → PUT …/disable with --yes', async () => {
    answer = WORKFLOW
    await wf('enable', WF)
    expect(calls[0]).toMatchObject({method: 'PUT', path: `${W}/${WF}/enable`})

    calls = []
    const refused = await wf('disable', WF)
    expect((refused.error as {code?: string} | undefined)?.code).toBe('CONFIRMATION_REQUIRED')
    expect(calls).toHaveLength(0)

    await wf('disable', WF, '--yes')
    expect(calls[0]).toMatchObject({method: 'PUT', path: `${W}/${WF}/disable`})
  })

  it('schema → GET /code/workflows/schema; --format yaml prints the schema document', async () => {
    answer = {schema: {schemaVersion: '1', definition: {type: 'object'}, stepKinds: [{kind: 'wait', description: 'Wait'}], bindings: []}}
    await wf('schema', '--format', 'yaml')

    expect(calls[0]).toMatchObject({method: 'GET', path: `${W}/schema`})
    expect(parseYaml(out())).toEqual((answer as {schema: unknown}).schema)
  })

  it('beta enable → PUT /code/workflows/enable; beta disable → PUT /code/workflows/disable with --yes', async () => {
    await runCommand(['code', 'workflows', 'beta', 'enable', ...globalArgs])
    expect(calls[0]).toMatchObject({method: 'PUT', path: `${W}/enable`})

    calls = []
    const refused = await runCommand(['code', 'workflows', 'beta', 'disable', ...globalArgs])
    expect((refused.error as {code?: string} | undefined)?.code).toBe('CONFIRMATION_REQUIRED')
    expect(calls).toHaveLength(0)

    await runCommand(['code', 'workflows', 'beta', 'disable', '--dry-run', ...globalArgs])
    expect(calls).toHaveLength(0)

    await runCommand(['code', 'workflows', 'beta', 'disable', '--yes', ...globalArgs])
    expect(calls[0]).toMatchObject({method: 'PUT', path: `${W}/disable`})
  })
})

describe('norbix code workflows — runs', () => {
  it('invoke → POST /code/workflows/{id}/invoke with payload, waitSeconds and runVersion', async () => {
    answer = {runId: RUN, status: 'succeeded', output: {sent: true}, durationMs: 40}
    const {error} = await wf('invoke', WF, '--payload', '{"orderId":"6ac54a59212c29912eaddd81"}', '--wait', '30', '--version', 'draft')

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({method: 'POST', path: `${W}/${WF}/invoke`})
    expect(calls[0]?.body).toEqual({payload: {orderId: '6ac54a59212c29912eaddd81'}, waitSeconds: 30, runVersion: 'draft'})
  })

  it('invoke --payload-file and --version 3; --wait 31 and --version latest are refused', async () => {
    await wf('invoke', WF, '--payload-file', tempFile('payload.json', '{"orderId":"o1"}'), '--version', '3')
    expect(calls[0]?.body).toEqual({payload: {orderId: 'o1'}, runVersion: '3'})

    calls = []
    expect((await wf('invoke', WF, '--wait', '31')).error?.message).toMatch(/31/)
    expect((await wf('invoke', WF, '--version', 'latest')).error?.message).toMatch(/neither draft nor a version number/)
    expect(calls).toHaveLength(0)
  })

  it('invoke --dry-run sends nothing', async () => {
    const {error} = await wf('invoke', WF, '--payload', '{"orderId":"o1"}', '--dry-run')

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
  })

  it('invoke --follow: a 202 running answer → polls GET /code/workflows/runs/{runId} until it settles, prints the run', async () => {
    queue = [
      {status: 202, body: {runId: RUN, status: 'running'}},
      {body: {run: {...RUN_DTO, status: 'running', finishedAt: undefined}}},
      {body: {run: RUN_DTO}},
    ]
    const {error} = await wf('invoke', WF, '--wait', '0', '--follow')

    expect(error).toBeUndefined()
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      `POST ${W}/${WF}/invoke`,
      `GET ${W}/runs/${RUN}`,
      `GET ${W}/runs/${RUN}`,
    ])
    expect(calls[0]?.body).toEqual({waitSeconds: 0})
    expect(out()).toContain(`Run ${RUN} of ${WF}: succeeded`)
    expect(out()).toMatch(/approve\s+wait\s+succeeded \(approved\)\s+1\s+1\s+2900 ms/)
  })

  it('invoke --follow does not poll an answer that is already finished', async () => {
    answer = {runId: RUN, status: 'failed', error: {code: 'CM-ERRORS-WORKFLOWS-020', stepId: 'notify'}}
    await wf('invoke', WF, '--follow')

    expect(calls).toHaveLength(1)
  })

  it('runs → GET /code/workflows/{id}/runs with status, from, to and pageSize', async () => {
    await wf('runs', WF, '--status', 'failed', '--from', '2026-10-01T00:00:00Z', '--to', '2026-10-27T00:00:00Z', '--limit', '50')

    expect(calls[0]).toMatchObject({method: 'GET', path: `${W}/${WF}/runs`})
    expect(calls[0]?.query.get('status')).toBe('failed')
    expect(calls[0]?.query.get('from')).toBe('2026-10-01T00:00:00Z')
    expect(calls[0]?.query.get('to')).toBe('2026-10-27T00:00:00Z')
    expect(calls[0]?.query.get('pageSize')).toBe('50')
  })

  it('run → GET /code/workflows/runs/{runId}, printed as a step table; --json prints the run', async () => {
    answer = {run: RUN_DTO}
    await wf('run', RUN)

    expect(calls[0]).toMatchObject({method: 'GET', path: `${W}/runs/${RUN}`})
    expect(out()).toMatch(/STEP\s+KIND\s+STATUS\s+ATTEMPT\s+PASS\s+DURATION/)
    expect(out()).toMatch(/notify\s+email\.send\s+succeeded\s+2\s+1\s+100 ms/)

    const {result} = await wf('run', RUN, '--json')
    expect(result).toEqual({run: RUN_DTO})
  })

  it('logs → GET /code/workflows/runs/{runId}/logs with stepId and level', async () => {
    await wf('logs', RUN, '--step', 'notify', '--level', 'Error')

    expect(calls[0]).toMatchObject({method: 'GET', path: `${W}/runs/${RUN}/logs`})
    expect(calls[0]?.query.get('stepId')).toBe('notify')
    expect(calls[0]?.query.get('level')).toBe('Error')
  })

  it('waiting --mine → GET /code/workflows/runs on the Hub with assignee=me and the filters', async () => {
    await wf('waiting', '--mine', '--kind', 'approval', '--workflow', WF, '--key', 'order-o1')

    expect(calls[0]).toMatchObject({method: 'GET', path: `${W}/runs`})
    expect(calls[0]?.host).toMatch(/\.hub\./)
    expect(calls[0]?.query.get('assignee')).toBe('me')
    expect(calls[0]?.query.get('waitingKind')).toBe('approval')
    expect(calls[0]?.query.get('workflowId')).toBe(WF)
    expect(calls[0]?.query.get('key')).toBe('order-o1')
  })

  it('waiting --mine --app-user → the same route on the Api host', async () => {
    await wf('waiting', '--mine', '--app-user')

    expect(calls[0]).toMatchObject({method: 'GET', path: `${W}/runs`})
    expect(calls[0]?.host).toMatch(/\.api\./)
    expect(calls[0]?.query.get('assignee')).toBe('me')
  })

  it('resume <runId> → POST /code/workflows/runs/{runId}/resume with stepId, decision and payload', async () => {
    answer = {run: RUN_DTO}
    const refused = await wf('resume', RUN, '--decision', 'approved')
    expect((refused.error as {code?: string} | undefined)?.code).toBe('CONFIRMATION_REQUIRED')
    expect(calls).toHaveLength(0)

    const {error} = await wf('resume', RUN, '--step', 'approve', '--decision', 'approved', '--payload', '{"note":"ok"}', '--yes')
    expect(error).toBeUndefined()
    expect(calls[0]).toMatchObject({method: 'POST', path: `${W}/runs/${RUN}/resume`})
    expect(calls[0]?.host).toMatch(/\.hub\./)
    expect(calls[0]?.body).toEqual({stepId: 'approve', decision: 'approved', payload: {note: 'ok'}})
  })

  it('resume <runId> --app-user → the Api host route', async () => {
    answer = {run: RUN_DTO}
    await wf('resume', RUN, '--decision', 'rejected', '--app-user', '--yes')

    expect(calls[0]).toMatchObject({method: 'POST', path: `${W}/runs/${RUN}/resume`})
    expect(calls[0]?.host).toMatch(/\.api\./)
  })

  it('resume --workflow --key → POST /code/workflows/{id}/resume with the key', async () => {
    answer = {run: RUN_DTO}
    await wf('resume', '--workflow', WF, '--key', 'order-o1', '--decision', 'rejected', '--yes')

    expect(calls[0]).toMatchObject({method: 'POST', path: `${W}/${WF}/resume`})
    expect(calls[0]?.body).toEqual({key: 'order-o1', decision: 'rejected'})
  })

  it('resume needs exactly one of a run id and --workflow/--key', async () => {
    expect((await wf('resume', '--yes')).error?.message).toMatch(/Name the run/)
    expect((await wf('resume', RUN, '--workflow', WF, '--key', 'k', '--yes')).error?.message).toMatch(/not both/)
    expect((await wf('resume', '--key', 'k', '--yes')).error?.message).toMatch(/--workflow/)
    expect(calls).toHaveLength(0)
  })

  it('retry → POST /code/workflows/runs/{runId}/retry with stepId; --dry-run sends nothing', async () => {
    await wf('retry', RUN, '--step', 'notify', '--dry-run')
    expect(calls).toHaveLength(0)

    answer = {run: RUN_DTO}
    await wf('retry', RUN, '--step', 'notify', '--yes')
    expect(calls[0]).toMatchObject({method: 'POST', path: `${W}/runs/${RUN}/retry`})
    expect(calls[0]?.body).toEqual({stepId: 'notify'})
  })

  it('cancel → POST /code/workflows/runs/{runId}/cancel with the reason, only with --yes', async () => {
    const refused = await wf('cancel', RUN)
    expect((refused.error as {code?: string} | undefined)?.code).toBe('CONFIRMATION_REQUIRED')
    expect(calls).toHaveLength(0)

    answer = {run: {...RUN_DTO, status: 'cancelled'}}
    await wf('cancel', RUN, '--reason', 'order-withdrawn', '--yes')
    expect(calls[0]).toMatchObject({method: 'POST', path: `${W}/runs/${RUN}/cancel`})
    expect(calls[0]?.body).toEqual({reason: 'order-withdrawn'})
  })
})

describe('workflows helpers', () => {
  it('formatOf: the extension decides; otherwise JSON when it parses, YAML when not', () => {
    expect(formatOf('a.json', 'name: x')).toBe('json')
    expect(formatOf('a.YML', '{}')).toBe('yaml')
    expect(formatOf('-', '{"a":1}')).toBe('json')
    expect(formatOf('-', 'a: 1')).toBe('yaml')
  })

  it('formatIssue and formatValidation read well with and without the optional parts', () => {
    expect(formatIssue({code: 'C', message: 'm'})).toBe('C  m')
    expect(formatIssue({code: 'C', message: 'm', line: 3})).toBe('C  m (line 3)')
    expect(formatValidation({isValid: true, errors: [], warnings: [{code: 'W', message: 'w'}]})).toBe('Valid — 1 warning.\n\nWarnings:\n  W  w')
  })

  it('formatRun shows what a waiting run waits on and the error of a failed one', () => {
    const waiting = formatRun({...RUN_DTO, status: 'waiting', waitingOn: [{stepId: 'approve', kind: 'approval', key: 'order-o1', assignees: ['usr_1']}], steps: []})
    expect(waiting).toContain('waiting on: step approve (approval) — key order-o1, assignees usr_1')

    const failed = formatRun({...RUN_DTO, status: 'failed', output: undefined, error: {code: 'CM-ERRORS-WORKFLOWS-020', stepId: 'notify', message: 'SMTP refused'}})
    expect(failed).toContain('error: CM-ERRORS-WORKFLOWS-020 · step notify — SMTP refused')
  })
})
