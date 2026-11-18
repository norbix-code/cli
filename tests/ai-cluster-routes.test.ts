import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {envListAnswer} from './_env.js'

/**
 * Matrix sections 06 AI · MCP, 07 AI · LLM integration and 08 AI chat: every
 * `ai llm…`, `ai mcp…`, `ai chat…` and `ai tool…` command, run the way a user
 * types it through oclif and the real `@norbix.ai/ts` transport. Each row
 * checks every request the command sends, in order: the host, the verb, the
 * exact path, the query and the JSON body. The older rows in
 * `project-routes.test.ts` check the host, verb and path only.
 *
 * `fetch` is replaced, so nothing leaves the process: no LLM, MCP server or
 * project is touched. The env rule's read of the environment list is answered
 * by `envListAnswer` and not counted.
 *
 * The end-user chat routes (`/{version}/ai/chat/*`, `/{version}/ai/tools` on
 * the API host) have no command: they need a signed-in project user, and the
 * CLI never signs in as one.
 */

const PROJECT = 'test-project'
const ID = '66b2f0a1'
const HUB = 'nb-eu-germany.hub.norbix.ai'
const LLM = '/v3/ai/integrations/llms'
const MCP = '/v3/ai/integrations/mcp'
const CHAT = '/v3/account/chat'
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
    const answer = url.pathname === `${CHAT}/turn` ? {sessionId: 'aics_1', reply: 'Done.', toolTrace: ['get_schemas']} : {}
    return new Response(JSON.stringify(answer), {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', PROJECT, '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

const dir = mkdtempSync(join(tmpdir(), 'nbx-ai-chat-'))
const NOTES = join(dir, 'notes.txt')
writeFileSync(NOTES, 'hello')

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

  // 08 — developer AI chat
  [['ai', 'chat', 'Hi', '--prod'], [['POST', `${CHAT}/turn`, {}, {message: 'Hi', profile: 'assistant', projectId: PROJECT, env: 'PROD'}]]],
  [['ai', 'chat', 'Hi', '--account-level'], [['POST', `${CHAT}/turn`, {}, {message: 'Hi', profile: 'assistant'}]]],
  [['ai', 'chat', 'More', '--session', 'aics_1', '--llm', 'int_llm1', '--model', 'gpt-4o-mini', '--prod'],
    [['POST', `${CHAT}/turn`, {}, {message: 'More', sessionId: 'aics_1', llmIntegrationId: 'int_llm1', model: 'gpt-4o-mini', projectId: PROJECT, env: 'PROD'}]]],
  [['ai', 'chat', 'availability', '--prod'], [['GET', `${CHAT}/availability`, {projectId: PROJECT, env: 'PROD'}, undefined]]],
  [['ai', 'chat', 'availability', '--account-level'], [['GET', `${CHAT}/availability`, {}, undefined]]],
  [['ai', 'chat', 'sessions', '--take', '20', '--archived'], [['GET', `${CHAT}/sessions`, {take: '20', includeArchived: 'true'}, undefined]]],
  [['ai', 'chat', 'entries', 'aics_1', '--since', '7'], [['GET', `${CHAT}/sessions/aics_1/entries`, {sinceSeq: '7'}, undefined]]],
  [['ai', 'chat', 'delete', 'aics_1', '--yes'], [['DELETE', `${CHAT}/sessions/aics_1`, {}, undefined]]],
  [['ai', 'chat', 'archive', 'aics_1'], [['PATCH', `${CHAT}/sessions/aics_1/archive`, {}, {archived: true}]]],
  [['ai', 'chat', 'archive', 'aics_1', '--undo'], [['PATCH', `${CHAT}/sessions/aics_1/archive`, {}, {archived: false}]]],
  [['ai', 'chat', 'pin', 'aics_1'], [['PATCH', `${CHAT}/sessions/aics_1/pin`, {}, {pinned: true}]]],
  [['ai', 'chat', 'sharing', 'aics_1', 'private'], [['PATCH', `${CHAT}/sessions/aics_1/sharing`, {}, {doNotShare: true}]]],
  [['ai', 'chat', 'sharing', 'aics_1', 'shared'], [['PATCH', `${CHAT}/sessions/aics_1/sharing`, {}, {doNotShare: false}]]],
  [['ai', 'chat', 'feedback', 'aics_1', 'ent_1', 'up'], [['POST', `${CHAT}/sessions/aics_1/entries/ent_1/feedback`, {}, {feedback: 'up'}]]],
  [['ai', 'chat', 'feedback', 'aics_1', 'ent_1', 'clear'], [['POST', `${CHAT}/sessions/aics_1/entries/ent_1/feedback`, {}, {feedback: ''}]]],
  [['ai', 'chat', 'answer', 'aics_1', 'ent_1', '--answer', 'q1=Yes', '--answer', 'q2=a=b'],
    [['POST', `${CHAT}/sessions/aics_1/questions/ent_1/answer`, {}, {answers: {q1: 'Yes', q2: 'a=b'}}]]],
  [['ai', 'chat', 'plan', 'aics_1', 'ent_1', 'reject', '--comment', 'Later'],
    [['POST', `${CHAT}/sessions/aics_1/plans/ent_1/decision`, {}, {decision: 'reject', comment: 'Later'}]]],
  [['ai', 'chat', 'plan', 'aics_1', 'ent_1', 'approve'], [['POST', `${CHAT}/sessions/aics_1/plans/ent_1/decision`, {}, {decision: 'approve'}]]],
  [['ai', 'chat', 'stop', 'aics_1', 'ent_1', '--yes'], [['POST', `${CHAT}/sessions/aics_1/steps/ent_1/stop`, {}, undefined]]],
  [['ai', 'chat', 'attach', NOTES, '--session', 'aics_1'],
    [['POST', `${CHAT}/attachments`, {}, {sessionId: 'aics_1', fileName: 'notes.txt', contentType: 'text/plain', base64Content: 'aGVsbG8='}]]],
  [['ai', 'chat', 'attach', NOTES, '--prod'],
    [['POST', `${CHAT}/attachments`, {}, {fileName: 'notes.txt', contentType: 'text/plain', base64Content: 'aGVsbG8=', profile: 'assistant', projectId: PROJECT, env: 'PROD'}]]],
  [['ai', 'chat', 'memory'], [['GET', `${CHAT}/memory`, {projectId: PROJECT}, undefined]]],
  [['ai', 'chat', 'memory', '--account-level'], [['GET', `${CHAT}/memory`, {}, undefined]]],
  [['ai', 'chat', 'forget', 'mem_1', '--yes'], [['DELETE', `${CHAT}/memory/mem_1`, {}, undefined]]],

  // 08 — the chat-tool inventory
  [['ai', 'tools'], [['GET', TOOLS, {}, undefined]]],
  [['ai', 'tools', '--toolset', 'ai:database-read'], [['GET', TOOLS, {toolset: 'ai:database-read'}, undefined]]],
  [['ai', 'tool', 'call', 'get_schemas', '--args', '{"take":5}', '--yes', '--prod'], [['POST', `${TOOLS}/get_schemas`, {}, {argumentsJson: '{"take":5}'}]]],
]

describe('every ai llm / mcp / chat / tool command sends exactly its request', () => {
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

it('covers the 8 LLM, 7 MCP, 15 developer chat and 2 AI tool routes', () => {
  const distinct = new Set(rows.flatMap(([, sent]) => sent.map(([verb, path]) => `${verb} ${path}`)))
  expect(distinct.size).toBe(8 + 7 + 15 + 2)
})

describe('ai chat guards', () => {
  it('a dry run of a turn sends nothing', async () => {
    const {error} = await runCommand(['ai', 'chat', 'Hi', '--prod', '--dry-run', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls).toEqual([])
  })

  it('a turn prints the reply, the tools it called and the session', async () => {
    const printed: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
      printed.push(parts.join(' '))
    })
    await runCommand(['ai', 'chat', 'Hi', '--prod', ...globalArgs])
    vi.restoreAllMocks()
    const stdout = printed.join('\n')

    expect(stdout).toContain('Done.')
    expect(stdout).toContain('Tools: get_schemas')
    expect(stdout).toContain('Session: aics_1')
  })

  it('delete, stop, forget and tool call ask first: without a terminal and --yes they send nothing', async () => {
    for (const argv of [
      ['ai', 'chat', 'delete', 'aics_1'],
      ['ai', 'chat', 'stop', 'aics_1', 'ent_1'],
      ['ai', 'chat', 'forget', 'mem_1'],
      ['ai', 'tool', 'call', 'get_schemas', '--prod'],
    ]) {
      const {error} = await runCommand([...argv, ...globalArgs])
      expect(error, argv.join(' ')).toBeDefined()
    }

    expect(calls).toEqual([])
  })

  it('answer refuses a value that is not key=value, tool call refuses arguments that are not a JSON object', async () => {
    const answer = await runCommand(['ai', 'chat', 'answer', 'aics_1', 'ent_1', '--answer', 'Yes', ...globalArgs])
    const tool = await runCommand(['ai', 'tool', 'call', 'get_schemas', '--args', '[1]', '--yes', '--prod', ...globalArgs])

    expect(answer.error?.message).toContain('not key=value')
    expect(tool.error?.message).toContain('not a JSON object')
    expect(calls).toEqual([])
  })

  it('attach needs a content type it can tell', async () => {
    const odd = join(dir, 'data.bin')
    writeFileSync(odd, 'x')
    const {error} = await runCommand(['ai', 'chat', 'attach', odd, '--session', 'aics_1', ...globalArgs])

    expect(error?.message).toContain('No content type')
    expect(calls).toEqual([])
  })
})
