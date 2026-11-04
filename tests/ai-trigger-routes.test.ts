import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {envListAnswer} from './_env.js'

/**
 * One row per Ai trigger endpoint: run the command the way a user types
 * it, through oclif and the real `@norbix.ai/ts` transport, and check the verb
 * and the exact path of the request it sends; then the save body — the file
 * with `type` filled in, the flags on top, a Code action and a Workflow action
 * carried as they are. `fetch` is replaced, so nothing leaves the process.
 */

const ID = '66b2f0a1'

interface Call {
  method: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

let calls: Call[]
let realFetch: typeof globalThis.fetch
let dir: string

beforeEach(() => {
  calls = []
  dir = mkdtempSync(join(tmpdir(), 'norbix-ai-trigger-'))
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
    return new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  rmSync(dir, {recursive: true, force: true})
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

const P = '/v3/ai/triggers'

/** A trigger file: an e-mail action on OnCreditsWarning. */
function triggerFile(extra: Record<string, unknown> = {}): string {
  const file = join(dir, 'trigger.json')
  writeFileSync(file, JSON.stringify({name: 'Notify', when: 'OnCreditsWarning', action: {type: 'Email', integrationId: 'int_1', templateId: 'tpl_1'}, ...extra}))
  return file
}

/** [argv, verb, path] — argv without the leading `ai`. */
const routes: Array<[() => string[], string, string]> = [
  [() => ['triggers'], 'GET', P],
  [() => ['trigger', ID], 'GET', `${P}/${ID}`],
  [() => ['trigger', 'save', '--file', triggerFile()], 'POST', P],
  [() => ['trigger', 'enable', ID], 'PATCH', `${P}/${ID}/enable`],
  [() => ['trigger', 'disable', ID, '--yes'], 'PATCH', `${P}/${ID}/disable`],
  [() => ['trigger', 'delete', ID, '--yes'], 'DELETE', `${P}/${ID}`],
]

describe('every ai trigger command reaches its route', () => {
  for (const [argv, verb, path] of routes) {
    it(`ai … → ${verb} ${path}`, async () => {
      const {error} = await runCommand(['ai', ...argv(), ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe(verb)
      expect(calls[0]?.path).toBe(path)
    })
  }

  it('covers the 6 ai trigger routes of the gateway', () => {
    expect(new Set(routes.map(([, verb, path]) => `${verb} ${path}`)).size).toBe(6)
  })
})

/** Run a command and return the one request it sent. */
async function callOf(argv: string[]): Promise<Call> {
  const {error} = await runCommand(['ai', ...argv, ...globalArgs])
  expect(error).toBeUndefined()
  expect(calls).toHaveLength(1)
  return calls[0]!
}

describe('ai trigger save', () => {
  it('fills type Ai and keeps the file', async () => {
    const {body} = await callOf(['trigger', 'save', '--file', triggerFile()])
    expect(body).toEqual({
      trigger: {type: 'Ai', name: 'Notify', when: 'OnCreditsWarning', action: {type: 'Email', integrationId: 'int_1', templateId: 'tpl_1'}},
    })
  })

  it('takes the whole request body ({"trigger": {...}}) and a `trigger definition` answer too', async () => {
    const file = join(dir, 'body.json')
    writeFileSync(file, JSON.stringify({trigger: {name: 'Notify', when: 'OnCreditsWarning', action: {type: 'WebhookCall'}}}))
    const {body} = await callOf(['trigger', 'save', '--file', file])
    expect(body?.trigger).toMatchObject({type: 'Ai', name: 'Notify', when: 'OnCreditsWarning'})
  })

  it('takes a `ai trigger <id> --json` answer: item unwrapped, thenAction saved as action', async () => {
    const file = join(dir, 'read.json')
    writeFileSync(file, JSON.stringify({item: {name: 'Notify', when: 'OnCreditsWarning', thenAction: {type: 'Sms', integrationId: 'int_1'}}}))
    const {body} = await callOf(['trigger', 'save', '--file', file])
    expect(body?.trigger).toEqual({type: 'Ai', name: 'Notify', when: 'OnCreditsWarning', action: {type: 'Sms', integrationId: 'int_1'}})
  })

  it('lets the flags override the file', async () => {
    const {body} = await callOf([
      'trigger', 'save', '--file', triggerFile({order: 5}), '--id', ID, '--when', 'OnQuotaExhausted',
      '--order', '1', '--break-on-error', '--execution-identity', 'default',
    ])
    expect(body?.trigger).toMatchObject({
      triggerId: ID,
      when: 'OnQuotaExhausted',
      order: 1,
      breakOnError: true,
      executionIdentityId: 'default',
    })
  })

  it('refuses a file without "when" when --when is not given, before any call', async () => {
    const {error} = await runCommand(['ai', 'trigger', 'save', '--file', triggerFile({when: undefined}), ...globalArgs])
    expect(error?.message).toMatch(/put "when" in the file or pass --when/)
    expect(error?.oclif?.exit).toBe(2)
    expect(calls).toHaveLength(0)
  })

  it('refuses an event the server does not fire', async () => {
    const {error} = await runCommand(['ai', 'trigger', 'save', '--file', triggerFile(), '--when', 'OnCreditsLow', ...globalArgs])
    expect(error?.message).toMatch(/Expected --when=OnCreditsLow to be one of/)
    expect(calls).toHaveLength(0)
  })

  it('sends a Code action as the file holds it: functionRef, invocationType, config', async () => {
    const file = join(dir, 'code.json')
    const action = {
      type: 'Code',
      functionRef: {integrationId: 'int_lambda', functionId: 'notify-sales', qualifier: 'live'},
      invocationType: 'Async',
      config: '{"source": "ai"}',
    }
    writeFileSync(file, JSON.stringify({name: 'Run a function', when: 'OnCreditsWarning', action}))
    const {body} = await callOf(['trigger', 'save', '--file', file, '--execution-identity', 'usr_1'])
    expect(body).toEqual({trigger: {type: 'Ai', name: 'Run a function', when: 'OnCreditsWarning', action, executionIdentityId: 'usr_1'}})
  })

  it('sends a Workflow action as the file holds it: workflowRef and payload', async () => {
    const file = join(dir, 'workflow.json')
    const action = {type: 'Workflow', workflowRef: 'wf_onboard', payload: {source: 'ai'}}
    writeFileSync(file, JSON.stringify({name: 'Start a workflow', when: 'OnQuotaExhausted', action}))
    const {body} = await callOf(['trigger', 'save', '--file', file])
    expect(body).toEqual({trigger: {type: 'Ai', name: 'Start a workflow', when: 'OnQuotaExhausted', action}})
  })
})

describe('ai trigger enable / disable / delete', () => {
  for (const [sub, verb, suffix] of [['enable', 'PATCH', '/enable'], ['disable', 'PATCH', '/disable'], ['delete', 'DELETE', '']] as const) {
    it(`${sub} puts the trigger id in the path and sends no body`, async () => {
      const call = await callOf(['trigger', sub, ID, ...(sub === 'enable' ? [] : ['--yes'])])
      expect(call.method).toBe(verb)
      expect(call.path).toBe(`${P}/${ID}${suffix}`)
      expect(call.body).toBeUndefined()
    })
  }

  it('disable asks before turning the trigger off', async () => {
    const {error} = await runCommand(['ai', 'trigger', 'disable', ID, ...globalArgs])
    expect(error?.message).toMatch(/Confirmation required: Turn off/)
    expect(calls).toHaveLength(0)
  })
})
