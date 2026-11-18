import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {envListAnswer} from './_env.js'

/**
 * Matrix sections 06 AI · MCP, 07 AI · LLM integration and 08 AI chat: every
 * `ai llm…`, `ai mcp…` and `ai tool…` command, run the way a user
 * types it through oclif and the real `@norbix.ai/ts` transport. Each row
 * checks every request the command sends, in order: the host, the verb, the
 * exact path, the query and the JSON body. The older rows in
 * `project-routes.test.ts` check the host, verb and path only.
 *
 * `fetch` is replaced, so nothing leaves the process: no LLM, MCP server or
 * project is touched. The env rule's read of the environment list is answered
 * by `envListAnswer` and not counted.
 *
 * The developer chat routes (`/{version}/account/chat/*`) were retired on
 * 2026-11-18 and have no command. The end-user chat routes
 * (`/{version}/ai/chat/*`, `/{version}/ai/tools` on the API host) have none
 * either: they need a signed-in project user, and the CLI never signs in as one.
 */

const PROJECT = 'test-project'
const ID = '66b2f0a1'
const HUB = 'nb-eu-germany.hub.norbix.ai'
const LLM = '/v3/ai/integrations/llms'
const MCP = '/v3/ai/integrations/mcp'
const TOOLS = '/v3/account/ai/tools'

interface Call {
  method: string
  host: string
  path: string
  query: URLSearchParams
  body?: unknown
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
      host: url.host,
      path: url.pathname,
      query: url.searchParams,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
    })
    return new Response(JSON.stringify({}), {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', PROJECT, '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

type Sent = [verb: string, path: string, query: Record<string, string>, body: unknown]

/** [argv, every request in order] */
const rows: Array<[string[], Sent[]]> = [
  // 07 — LLM integrations
  [['ai', 'llms'], [['GET', `${LLM}/integrations`, {}, undefined]]],
  [['ai', 'llms', '--page-size', '50', '--after', 'int_llm0'], [['GET', `${LLM}/integrations`, {pageSize: '50', startingAfter: 'int_llm0'}, undefined]]],
  [['ai', 'llm', ID], [['GET', `${LLM}/${ID}`, {}, undefined]]],
  [['ai', 'llm', 'save', '--provider', 'OpenAI', '--name', 'OpenAI', '--model', 'gpt-4o-mini'],
    [['POST', `${LLM}/`, {}, {integration: {provider: 'OpenAI', integrationName: 'OpenAI', defaultModel: 'gpt-4o-mini', isDefault: false, isEnabled: true}}]]],
  [['ai', 'llm', 'test', ID], [['POST', `${LLM}/test`, {}, {integrationId: ID}]]],
  [['ai', 'llm', 'enable', ID], [['PUT', `${LLM}/${ID}/enable`, {}, undefined]]],
  [['ai', 'llm', 'disable', ID, '--yes'], [['PUT', `${LLM}/${ID}/disable`, {}, undefined]]],
  [['ai', 'llm', 'default', ID], [['PUT', `${LLM}/${ID}/default`, {}, undefined]]],
  [['ai', 'llm', 'delete', ID, '--yes'], [['DELETE', `${LLM}/${ID}`, {}, undefined]]],

  // 06 — MCP integrations (deprecated on the gateway; save is refused with -030 there)
  [['ai', 'mcps'], [['GET', `${MCP}/integrations`, {}, undefined]]],
  [['ai', 'mcps', '--page-size', '20'], [['GET', `${MCP}/integrations`, {pageSize: '20'}, undefined]]],
  [['ai', 'mcp', ID], [['GET', `${MCP}/${ID}`, {}, undefined]]],
  [['ai', 'mcp', 'save', '--provider', 'GitHub', '--name', 'GitHub', '--server-name', 'GitHub', '--category', 'Code', '--description', 'Issues', '--icon', 'github'],
    [['POST', `${MCP}/`, {}, {integration: {provider: 'GitHub', integrationName: 'GitHub', name: 'GitHub', category: 'Code', description: 'Issues', icon: 'github', isEnabled: true}}]]],
  [['ai', 'mcp', 'test', ID], [['POST', `${MCP}/test`, {}, {integrationId: ID}]]],
  [['ai', 'mcp', 'enable', ID], [['PUT', `${MCP}/${ID}/enable`, {}, undefined]]],
  [['ai', 'mcp', 'disable', ID, '--yes'], [['PUT', `${MCP}/${ID}/disable`, {}, undefined]]],
  [['ai', 'mcp', 'delete', ID, '--yes'], [['DELETE', `${MCP}/${ID}`, {}, undefined]]],

  // 08 — the AI tool inventory
  [['ai', 'tools'], [['GET', TOOLS, {}, undefined]]],
  [['ai', 'tools', '--toolset', 'ai:database-read'], [['GET', TOOLS, {toolset: 'ai:database-read'}, undefined]]],
  [['ai', 'tool', 'call', 'get_schemas', '--args', '{"take":5}', '--yes', '--prod'], [['POST', `${TOOLS}/get_schemas`, {}, {argumentsJson: '{"take":5}'}]]],
]

describe('every ai llm / mcp / tool command sends exactly its request', () => {
  for (const [argv, expected] of rows) {
    it(`${argv.join(' ')} → ${expected.map(([verb, path]) => `${verb} ${path}`).join(', ')}`, async () => {
      const {error} = await runCommand([...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls.map((c) => [c.method, c.host, c.path, Object.fromEntries(c.query), c.body])).toEqual(
        expected.map(([verb, path, query, body]) => [verb, HUB, path, query, body]),
      )
    })
  }
})

it('covers the 8 LLM, 7 MCP and 2 AI tool routes', () => {
  const distinct = new Set(rows.flatMap(([, sent]) => sent.map(([verb, path]) => `${verb} ${path}`)))
  expect(distinct.size).toBe(8 + 7 + 2)
})

it('has no developer chat command', async () => {
  const {error} = await runCommand(['ai', 'chat', 'Hi', ...globalArgs])

  expect(error).toBeDefined()
  expect(calls).toEqual([])
})

describe('ai tool guards', () => {
  it('tool call asks first: without a terminal and --yes it sends nothing', async () => {
    const {error} = await runCommand(['ai', 'tool', 'call', 'get_schemas', '--prod', ...globalArgs])

    expect(error).toBeDefined()
    expect(calls).toEqual([])
  })

  it('tool call refuses arguments that are not a JSON object', async () => {
    const tool = await runCommand(['ai', 'tool', 'call', 'get_schemas', '--args', '[1]', '--yes', '--prod', ...globalArgs])

    expect(tool.error?.message).toContain('not a JSON object')
    expect(calls).toEqual([])
  })
})
