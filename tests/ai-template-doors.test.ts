import {runCommand} from '@oclif/test'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {cli, makeHome, parseSingleJson, startFakeGateway, type FakeGateway} from './_cli.js'

/**
 * The template read doors: `ai templates`, `ai template`, `ai schema-templates`
 * and `ai schema-template`, run the way a user types them through oclif and
 * the real `@norbix.ai/ts` transport. Each calls one read-only AI tool through
 * the tool bridge on the Hub. The request rows replace `fetch`, so nothing
 * leaves the process. What a command prints is checked on the built CLI run as
 * a process against a fake gateway that answers with the gateway's envelope.
 */

const HUB = 'nb-eu-germany.hub.norbix.ai'
const TOOLS = '/v3/account/ai/tools'

const HR_CARD = {
  id: 'hr',
  name: 'HR',
  version: 1,
  tags: ['hr', 'employees'],
  summary: 'An HR backend.',
  collections: [{entity: 'employees', tier: 'standard'}],
  matchedTags: ['hr'],
}

/** tool name → the envelope the gateway answers with */
const ANSWERS: Record<string, unknown> = {
  get_app_templates: {ok: true, data: {templates: [HR_CARD, {...HR_CARD, id: 'blog', name: 'Blog', matchedTags: []}]}},
  get_app_template: {
    ok: true,
    data: {template: HR_CARD, guide: '# HR — App Template\n\n## Modules\n', collectionSpecs: [{fileName: 'applicants.schema.json', json: '{"entity":"applicants"}'}]},
  },
  search_schema_templates: {
    ok: true,
    data: {total: 2, templates: [{id: 'employees', title: 'Employee', summary: 'An employee record.', related: ['departments'], matchedOn: ['id']}]},
  },
  get_entity_graph: {ok: true, data: {capped: false, unknown: [], entities: [{id: 'employees', related: ['departments'], ifDocument: '{"entity":"employees"}'}]}},
}

interface Call {
  method: string
  host: string
  path: string
  headers: Record<string, string>
  body?: unknown
}

let calls: Call[]
let answers: Record<string, unknown>
let realFetch: typeof globalThis.fetch

beforeEach(() => {
  calls = []
  answers = {...ANSWERS}
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push({
      method: init?.method ?? 'GET',
      host: url.host,
      path: url.pathname,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
    })
    const tool = url.pathname.split('/').pop() ?? ''
    return new Response(JSON.stringify({result: JSON.stringify(answers[tool])}), {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

/** [argv, tool, the arguments sent as JSON text] */
const rows: Array<[string[], string, string]> = [
  [['ai', 'templates'], 'get_app_templates', '{}'],
  [['ai', 'templates', 'hr-portal'], 'get_app_templates', '{"query":"hr-portal"}'],
  [['ai', 'template', 'hr'], 'get_app_template', '{"id":"hr"}'],
  [['ai', 'schema-templates'], 'search_schema_templates', '{}'],
  [['ai', 'schema-templates', 'employee', '--take', '5'], 'search_schema_templates', '{"query":"employee","take":5}'],
  [['ai', 'schema-template', 'employees,departments'], 'get_entity_graph', '{"names":"employees,departments"}'],
  [['ai', 'schema-template', 'employees', '--depth', '0'], 'get_entity_graph', '{"names":"employees","depth":0}'],
]

describe('every template door command calls its read-only AI tool once, and asks nothing', () => {
  for (const [argv, tool, argumentsJson] of rows) {
    it(`${argv.join(' ')} → POST ${TOOLS}/${tool} ${argumentsJson}`, async () => {
      const {error} = await runCommand([...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls.map((c) => [c.method, c.host, c.path, c.body])).toEqual([['POST', HUB, `${TOOLS}/${tool}`, {argumentsJson}]])
    })
  }

  it('the returned document has every spec and IF document as an object, not as text', async () => {
    const template = await runCommand(['ai', 'template', 'hr', ...globalArgs])
    const graph = await runCommand(['ai', 'schema-template', 'employees', ...globalArgs])

    expect((template.result as {collectionSpecs: unknown}).collectionSpecs).toEqual([{fileName: 'applicants.schema.json', spec: {entity: 'applicants'}}])
    expect((graph.result as {entities: unknown}).entities).toEqual([{id: 'employees', related: ['departments'], ifDocument: {entity: 'employees'}}])
  })
})

// ── the built CLI as a process: what it prints, and how it fails ──────────────

let gateway: FakeGateway
let home: string
const gatewayAnswers: Record<string, unknown> = {}
const answer = (tool: string, envelope: unknown) => {
  gatewayAnswers[`${TOOLS}/${tool}`] = {result: JSON.stringify(envelope)}
}

beforeAll(async () => {
  gateway = await startFakeGateway(gatewayAnswers)
  home = makeHome(gateway.port)
})

afterAll(async () => {
  await gateway.close()
})

describe('what the template door commands print', () => {
  beforeEach(() => {
    for (const [tool, envelope] of Object.entries(ANSWERS)) answer(tool, envelope)
  })

  it('ai templates lists the cards and says how to read one', async () => {
    const r = await cli(home, ['ai', 'templates', 'hr portal', '--profile', 'x'])

    expect(r.code).toBe(0)
    expect(r.stdout).toContain('hr  HR, version 1  (matches: hr)')
    expect(r.stdout).toContain('blog  Blog, version 1\n')
    expect(r.stdout).toContain('collections: employees')
    expect(r.stdout).toContain('Read one: norbix ai template <id>')
  })

  it('ai template prints the guide, and the specs only with --specs', async () => {
    const guide = await cli(home, ['ai', 'template', 'hr', '--profile', 'x'])
    const specs = await cli(home, ['ai', 'template', 'hr', '--specs', '--profile', 'x'])

    expect(guide.stdout).toContain('# HR — App Template')
    expect(guide.stdout).toContain('Collection specs: applicants.schema.json  (print them with --specs)')
    expect(specs.stdout).toContain('--- applicants.schema.json')
    expect(specs.stdout).toContain('"entity": "applicants"')
  })

  it('--json prints exactly one JSON document', async () => {
    const r = await cli(home, ['ai', 'template', 'hr', '--json', '--profile', 'x'])

    expect(r.code).toBe(0)
    expect((parseSingleJson(r.stdout) as {template: {id: string}}).template.id).toBe('hr')
  })

  it('ai schema-templates says where each hit matched and how many there are', async () => {
    const r = await cli(home, ['ai', 'schema-templates', 'employee', '--profile', 'x'])

    expect(r.stdout).toContain('employees  Employee  (matched on: id)')
    expect(r.stdout).toContain('related: departments')
    expect(r.stdout).toContain('1 of 2.')
  })
})

describe('when a door fails', () => {
  it('an unknown template is "not found" (exit 5) with the gateway code and message', async () => {
    answer('get_app_template', {
      ok: false,
      errors: [{code: 'CM-ERRORS-AI-TEMPLATES-001', message: "There is no app template 'warehouse'. The app templates are: blog, crm, hr."}],
    })

    const r = await cli(home, ['ai', 'template', 'warehouse', '--json', '--profile', 'x'])
    const error = (parseSingleJson(r.stdout) as {error: {code: string; exit: number; message: string; hint?: string}}).error

    expect([r.code, error.code, error.exit, error.message]).toEqual([
      5, 'CM-ERRORS-AI-TEMPLATES-001', 5, "There is no app template 'warehouse'. The app templates are: blog, crm, hr.",
    ])
    // The CLI's usual hint for a 404-like answer, not the "older gateway" one.
    expect(error.hint ?? '').not.toContain('may not have the template read doors')
  })

  it('a gateway older than the doors is said plainly, not shown as an empty list', async () => {
    answer('get_app_templates', {ok: false, errors: [{code: 'UnknownTool', message: "Unknown tool 'get_app_templates'."}]})

    const r = await cli(home, ['ai', 'templates', '--json', '--profile', 'x'])
    const error = (parseSingleJson(r.stdout) as {error: {message: string; hint: string}}).error

    expect(r.code).not.toBe(0)
    expect(error.message).toBe("Unknown tool 'get_app_templates'.")
    expect(error.hint).toContain('may not have the template read doors yet')
  })
})
