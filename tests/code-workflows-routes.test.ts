import {runCommand} from '@oclif/test'
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {parse as parseYaml} from 'yaml'

import {BETA_NOTE, formatGroupApproval, formatIssue, formatOf, formatRun, formatSlots, formatValidation, formatWaitingRuns} from '../src/lib/workflows.js'
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
  it('invoke → POST /code/workflows/{id}/invoke on api with payload, waitSeconds and runVersion', async () => {
    answer = {runId: RUN, status: 'succeeded', output: {sent: true}, durationMs: 40}
    const {error} = await wf('invoke', WF, '--payload', '{"orderId":"6ac54a59212c29912eaddd81"}', '--wait', '30', '--version', 'draft')

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({method: 'POST', path: `${W}/${WF}/invoke`})
    expect(calls[0]?.host).toMatch(/\.api\./)
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
    expect(out()).toMatch(/STEP\s+KIND\s+STATUS\s+ATTEMPT\s+PASS\s+ITEM\s+DURATION/)
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

  it('resume of a group approval prints the run still waiting, with the approvals so far', async () => {
    answer = {
      run: {
        ...RUN_DTO,
        status: 'waiting',
        finishedAt: undefined,
        output: undefined,
        steps: [],
        waitingOn: [
          {
            stepId: 'approve',
            kind: 'approval',
            assignees: ['usr_anna', 'usr_ben'],
            require: 2,
            answers: [{userId: 'usr_anna', decision: 'approved', at: '2026-11-12T10:15:00Z'}],
          },
        ],
      },
    }
    const {error} = await wf('resume', RUN, '--decision', 'approved', '--yes')

    expect(error).toBeUndefined()
    expect(out()).toContain(`Run ${RUN} of ${WF}: waiting`)
    expect(out()).toContain('  approve: group approval — 1 of 2 approvals, waiting for usr_ben')
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

describe('norbix code workflows resume-link', () => {
  const TOKEN = 'eyJydW4iOiJ3ZnJfNW5CMiJ9.sig-1'
  const LINK = {runId: RUN, workflowId: WF, workflowName: 'Approve big orders', stepId: 'approve', stepName: 'Manager approval', mode: 'approval', decision: 'approved', assigneeUserId: 'usr_anna', expiresAt: '2026-11-20T08:00:00Z'}

  it('<token> → GET /code/workflows/resume/{token} on the Api host, no query, no body; prints what it will do', async () => {
    answer = LINK
    const {error} = await wf('resume-link', TOKEN)

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({method: 'GET', path: `${W}/resume/${TOKEN}`, body: undefined})
    expect(calls[0]?.host).toMatch(/\.api\./)
    expect([...calls[0]!.query.keys()]).toEqual([])
    expect(out()).toContain('Workflow: Approve big orders (' + WF + ')')
    expect(out()).toContain('Does:     approval: approved')
    expect(out()).toContain('Expires:  2026-11-20T08:00:00Z')
  })

  it('takes the whole link from the notification, query and all', async () => {
    answer = LINK
    await wf('resume-link', `https://api.norbix.ai/v3/code/workflows/resume/${TOKEN}?utm=mail`)

    expect(calls[0]).toMatchObject({method: 'GET', path: `${W}/resume/${TOKEN}`})
    expect([...calls[0]!.query.keys()]).toEqual([])
  })

  it('--use → POST /code/workflows/resume/{token}, only with --yes; prints the run', async () => {
    const refused = await wf('resume-link', TOKEN, '--use')
    expect((refused.error as {code?: string} | undefined)?.code).toBe('CONFIRMATION_REQUIRED')
    expect(calls).toHaveLength(0)

    answer = {run: RUN_DTO}
    const {error} = await wf('resume-link', TOKEN, '--use', '--yes')
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({method: 'POST', path: `${W}/resume/${TOKEN}`})
    expect(calls[0]?.host).toMatch(/\.api\./)
    expect(calls[0]?.body ?? {}).toEqual({})
    expect(out()).toContain(`Run ${RUN} of ${WF}: succeeded`)
  })

  it('--use --dry-run sends nothing; a link with no token is refused before any call', async () => {
    await wf('resume-link', TOKEN, '--use', '--dry-run')
    expect(calls).toHaveLength(0)

    const {error} = await wf('resume-link', 'https://api.norbix.ai/v3/code/workflows/resume/')
    expect(error?.message).toMatch(/not a resume link or token/)
    expect(calls).toHaveLength(0)
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

  it('formatWaitingRuns prints one row per wait, the next-page cursor, and says when nothing waits', () => {
    const table = formatWaitingRuns({
      list: {
        items: [
          {runId: RUN, workflowId: WF, status: 'waiting', waitingOn: [{stepId: 'approve', kind: 'approval', key: 'order-o1', assignees: ['usr_1', 'usr_2']}]},
          {runId: 'wfr_2', workflowId: WF, status: 'waiting', waitingOn: [{stepId: 'cool', kind: 'delay', until: '2026-11-02T10:00:00Z'}]},
        ],
        hasMore: true,
        startingAfter: 'wfr_2',
      },
    })
    expect(table.split('\n')).toEqual([
      'RUN                         WORKFLOW                   STEP     KIND      KEY       ASKS          YOURS  UNTIL                 CHILD',
      `${RUN}  ${WF}  approve  approval  order-o1  usr_1, usr_2  —      —                     —`,
      `wfr_2                       ${WF}  cool     delay     —         —             —      2026-11-02T10:00:00Z  —`,
      '',
      '2 waiting. Read one: norbix code workflows run <run>',
      'More: add --after wfr_2',
    ])
    expect(formatWaitingRuns({list: {items: []}})).toBe('No runs match.')
  })

  it('a wait on a child run shows the child, in the run and in the inbox', () => {
    const wait = {stepId: 'fulfil', kind: 'child', until: '2026-11-02T10:00:00Z', childRunId: 'wfr_child1'}

    expect(formatRun({...RUN_DTO, status: 'waiting', waitingOn: [wait], steps: []})).toContain(
      'waiting on: step fulfil (child) — child run wfr_child1, until 2026-11-02T10:00:00Z',
    )
    expect(formatWaitingRuns({list: {items: [{runId: RUN, workflowId: WF, status: 'waiting', waitingOn: [wait]}]}}).split('\n')[1]).toBe(
      `${RUN}  ${WF}  fulfil  child  —    —     —      2026-11-02T10:00:00Z  wfr_child1`,
    )
  })

  it('waiting --kind child → the filter goes to the Hub', async () => {
    await wf('waiting', '--kind', 'child')

    expect(calls[0]?.query.get('waitingKind')).toBe('child')
  })

  it('resume says a wait on a child run cannot be resumed by hand', async () => {
    const {default: resume} = await import('../src/commands/code/workflows/resume.js')

    expect(resume.description).toContain('A wait on a child run cannot be resumed by hand (the gateway answers CM-ERRORS-WORKFLOWS-016)')
  })

  it('formatRun shows what a waiting run waits on and the error of a failed one', () => {
    const waiting = formatRun({...RUN_DTO, status: 'waiting', waitingOn: [{stepId: 'approve', kind: 'approval', key: 'order-o1', assignees: ['usr_1']}], steps: []})
    expect(waiting).toContain('waiting on: step approve (approval) — key order-o1, told usr_1')

    const failed = formatRun({...RUN_DTO, status: 'failed', output: undefined, error: {code: 'CM-ERRORS-WORKFLOWS-020', stepId: 'notify', message: 'SMTP refused'}})
    expect(failed).toContain('error: CM-ERRORS-WORKFLOWS-020 · step notify — SMTP refused')
  })

  it('formatGroupApproval says how many approvals of how many, the rejections, and who has not answered', () => {
    const wait = {stepId: 'approve', kind: 'approval', assignees: ['usr_anna', 'usr_ben', 'usr_cara'], require: 2}

    // nobody answered yet
    expect(formatGroupApproval(wait)).toBe('group approval — 0 of 2 approvals, waiting for usr_anna, usr_ben, usr_cara')
    expect(formatGroupApproval({...wait, answers: []})).toBe('group approval — 0 of 2 approvals, waiting for usr_anna, usr_ben, usr_cara')
    // one approval
    expect(formatGroupApproval({...wait, answers: [{userId: 'usr_anna', decision: 'approved', at: '2026-11-12T10:15:00Z'}]})).toBe(
      'group approval — 1 of 2 approvals, waiting for usr_ben, usr_cara',
    )
    // one approval and one rejection
    expect(
      formatGroupApproval({
        ...wait,
        answers: [
          {userId: 'usr_anna', decision: 'approved', at: '2026-11-12T10:15:00Z'},
          {userId: 'usr_ben', decision: 'rejected', at: '2026-11-12T10:20:00Z'},
        ],
      }),
    ).toBe('group approval — 1 of 2 approvals, 1 rejection, waiting for usr_cara')
    // one needed: singular; no assignees in the record: no "waiting for"
    expect(formatGroupApproval({stepId: 'approve', kind: 'approval', require: 1})).toBe('group approval — 0 of 1 approval')
    // not a group approval: nothing
    expect(formatGroupApproval({stepId: 'approve', kind: 'approval', assignees: ['usr_anna']})).toBe('')
    expect(formatGroupApproval(undefined)).toBe('')
  })

  it('an approval addressed to roles counts SLOTS, names the rule and marks an override', () => {
    // Two roles must approve. HR is open; the accountant's slot was settled by
    // somebody the step never asked, on the override right. Six people were
    // told when it parked — "1 of 2", never "1 of 6".
    const wait = {
      stepId: 'approve',
      kind: 'approval',
      key: 'order-o1',
      assignees: ['usr_hr1', 'usr_hr2', 'usr_hr3', 'usr_hr4', 'usr_hr5', 'usr_acc'],
      require: 2,
      mine: false,
      slots: [
        {label: 'role:HR', role: 'pr_x_nr_hr'},
        {label: 'role:Accountant', role: 'pr_x_nr_acc', answeredBy: 'usr_boss', decision: 'approved', at: '2026-11-13T09:00:00Z', override: true},
      ],
      answers: [{userId: 'usr_boss', kind: 'user', decision: 'approved', slots: [1], override: true, at: '2026-11-13T09:00:00Z'}],
    }

    expect(formatGroupApproval(wait)).toBe('group approval — 1 of 2 approvals, 1 by override, waiting for role:HR')

    const table = formatWaitingRuns({list: {items: [{runId: RUN, workflowId: WF, status: 'waiting', waitingOn: [wait]}]}}).split('\n')
    // ASKS is the rule still open, not the six people told; YOURS warns before an override.
    expect(table[0]).toContain('ASKS')
    expect(table[0]).toContain('YOURS')
    expect(table[1]).toContain('role:HR')
    expect(table[1]).toContain('override')
    expect(table).toContain('    role:HR: open')
    expect(table).toContain('    role:Accountant: approved by usr_boss (override) at 2026-11-13T09:00:00Z')
    expect(table.at(-1)).toBe(
      '1 row marked "override": the step does not ask you. Answering settles every part still open and is recorded as yours.',
    )
  })

  it('an approval whose open slot is the caller\'s says so, and one with no answer to give says nothing', () => {
    const mine = {stepId: 'approve', kind: 'approval', require: 1, mine: true, slots: [{label: 'role:HR', role: 'r1'}]}
    const unknown = {stepId: 'approve', kind: 'approval', require: 1, slots: [{label: 'role:HR', role: 'r1'}]}

    const yours = formatWaitingRuns({list: {items: [{runId: RUN, workflowId: WF, status: 'waiting', waitingOn: [mine]}]}}).split('\n')
    expect(yours[1]).toContain('yes')
    expect(yours.at(-1)).toBe('1 waiting. Read one: norbix code workflows run <run>')

    const quiet = formatWaitingRuns({list: {items: [{runId: RUN, workflowId: WF, status: 'waiting', waitingOn: [unknown]}]}}).split('\n')
    expect(quiet[1]).toContain('—')
    expect(quiet.join('\n')).not.toContain('override')
  })

  it('a run parked before slots existed still counts right: the people asked are the slots', () => {
    const old = {
      stepId: 'approve',
      kind: 'approval',
      assignees: ['usr_anna', 'usr_ben', 'usr_cara'],
      require: 2,
      answers: [{userId: 'usr_anna', decision: 'approved', at: '2026-11-12T10:15:00Z'}],
    }

    expect(formatGroupApproval(old)).toBe('group approval — 1 of 2 approvals, waiting for usr_ben, usr_cara')
    // No slots to list: the lines under the group line are only for a wait that has them.
    expect(formatSlots(old)).toEqual([])
  })

  it('formatRun adds one line per group approval and leaves a plain wait as it was', () => {
    const group = {
      stepId: 'approve',
      kind: 'approval',
      assignees: ['usr_anna', 'usr_ben'],
      require: 2,
      answers: [{userId: 'usr_anna', decision: 'approved', at: '2026-11-12T10:15:00Z'}],
    }
    const plain = {stepId: 'legal', kind: 'approval', assignees: ['usr_cara']}
    const lines = formatRun({...RUN_DTO, status: 'waiting', output: undefined, waitingOn: [group, plain], steps: []}).split('\n')

    expect(lines.slice(2)).toEqual([
      '  waiting on: step approve (approval) — told usr_anna, usr_ben',
      '  approve: group approval — 1 of 2 approvals, waiting for usr_ben',
      '  waiting on: step legal (approval) — told usr_cara',
    ])
  })

  it('formatWaitingRuns keeps the table and lists the group approvals under it', () => {
    const table = formatWaitingRuns({
      list: {
        items: [
          {
            runId: RUN,
            workflowId: WF,
            status: 'waiting',
            waitingOn: [
              {
                stepId: 'approve',
                kind: 'approval',
                key: 'order-o1',
                assignees: ['usr_1', 'usr_2'],
                require: 2,
                answers: [{userId: 'usr_1', decision: 'approved', at: '2026-11-12T10:15:00Z'}],
              },
            ],
          },
          {runId: 'wfr_2', workflowId: WF, status: 'waiting', waitingOn: [{stepId: 'cool', kind: 'delay', until: '2026-11-02T10:00:00Z'}]},
        ],
      },
    })

    expect(table.split('\n')).toEqual([
      'RUN                         WORKFLOW                   STEP     KIND      KEY       ASKS          YOURS  UNTIL                 CHILD',
      `${RUN}  ${WF}  approve  approval  order-o1  usr_1, usr_2  —      —                     —`,
      `wfr_2                       ${WF}  cool     delay     —         —             —      2026-11-02T10:00:00Z  —`,
      '',
      'Group approvals:',
      `  ${RUN} approve: group approval — 1 of 2 approvals, waiting for usr_2`,
      '',
      '2 waiting. Read one: norbix code workflows run <run>',
    ])
  })

  it('resume says a group approval counts slots, that one answer fills every slot you match, and what an override is', async () => {
    const {default: resume} = await import('../src/commands/code/workflows/resume.js')

    expect(resume.description).toContain('A group approval')
    expect(resume.description).toContain('counts your answer in SLOTS')
    expect(resume.description).toContain('One answer fills every slot you match')
    expect(resume.description).toContain('Answering the same wait twice is refused (CM-ERRORS-WORKFLOWS-016)')
    // the rules an assignee may be, and what happens when the step does not ask you
    expect(resume.description).toContain('teamrole:<name>')
    expect(resume.description).toContain('unless you hold the override right')
  })

  it('waiting explains that ASKS is the open slots and YOURS warns before an override', async () => {
    const {default: waiting} = await import('../src/commands/code/workflows/waiting.js')

    expect(waiting.description).toContain('ASKS is the slots nobody has filled')
    expect(waiting.description).toContain('never the list of people told when the wait parked')
    expect(waiting.description).toContain('"override" when none of them is')
  })

  it('formatRun tells two elements of one foreach body apart, from #0, and leaves a plain step empty', () => {
    const text = formatRun({
      ...RUN_DTO,
      steps: [
        {stepId: 'load', kind: 'database.find', status: 'succeeded', attempt: 1, pass: 1, durationMs: 12},
        {stepId: 'eachOrder', kind: 'foreach', status: 'failed', attempt: 1, pass: 1, durationMs: 90},
        {stepId: 'thank', kind: 'email.send', status: 'succeeded', attempt: 1, pass: 1, foreachStepId: 'eachOrder', itemIndex: 0, durationMs: 40},
        {stepId: 'thank', kind: 'email.send', status: 'failed', attempt: 1, pass: 2, foreachStepId: 'eachOrder', itemIndex: 1, durationMs: 41, error: {code: 'CM-ERRORS-WORKFLOWS-038', message: 'refused'}},
        {stepId: 'thank', kind: 'email.send', status: 'failed', attempt: 1, pass: 3, foreachStepId: 'eachOrder', itemIndex: 2, durationMs: 42, error: {code: 'CM-ERRORS-WORKFLOWS-038', message: 'refused'}},
      ],
    })

    expect(text).toMatch(/STEP\s+KIND\s+STATUS\s+ATTEMPT\s+PASS\s+ITEM\s+DURATION/)
    expect(text).toMatch(/thank\s+email\.send\s+succeeded\s+1\s+1\s+#0\s+40 ms/)
    expect(text).toMatch(/thank\s+email\.send\s+failed\s+1\s+2\s+#1\s+41 ms/)
    expect(text).toMatch(/load\s+database\.find\s+succeeded\s+1\s+1\s+12 ms/)
    expect(text).toContain('  thank #1 attempt 1: CM-ERRORS-WORKFLOWS-038 — refused')
    expect(text).toContain('  thank #2 attempt 1: CM-ERRORS-WORKFLOWS-038 — refused')
  })
})
