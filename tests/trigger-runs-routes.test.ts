import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {envListAnswer} from './_env.js'
import {formatCampaignStats, printTemplateWarnings, templateWarnings} from '../src/lib/campaigns.js'
import {formatIdentities, formatTriggerRun, formatTriggerRuns} from '../src/lib/triggers.js'

/**
 * Trigger runs, execution identities, the identity flag on saves, the campaign
 * stats lines and the template warnings: through oclif and the real
 * `@norbix.ai/ts` transport, with `fetch` replaced, so nothing leaves the process.
 */
interface Call {
  method: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

const RUN = 'trr_1p4R3gTobGZpD6fX'
const TRG = 'trg_8d1e0b'

let calls: Call[]
let answers: Array<{status: number; body: unknown}>
let realFetch: typeof globalThis.fetch
let dir: string

beforeEach(() => {
  calls = []
  answers = []
  dir = mkdtempSync(join(tmpdir(), 'norbix-trigger-'))
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
    const {status, body} = answers.shift() ?? {status: 200, body: {}}
    return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  rmSync(dir, {recursive: true, force: true})
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

const notFound = {
  status: 404,
  body: {responseStatus: {errors: [{errorCode: 'CM-ERRORS-TRIGGERS-022', message: 'Run not found'}]}},
}

function triggerFile(): string {
  const file = join(dir, 'trigger.json')
  writeFileSync(file, JSON.stringify({name: 'Paid', action: {type: 'WebhookCall'}}))
  return file
}

describe('trigger runs', () => {
  it('sends the type, the trigger and the filters on the query of a GET', async () => {
    const {error} = await runCommand(['trigger', 'runs', 'Membership', TRG, '--status', 'failed', '--page-size', '5', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]!.method).toBe('GET')
    expect(calls[0]!.path).toBe('/v3/triggers/runs')
    expect(Object.fromEntries(calls[0]!.query)).toMatchObject({
      triggerType: 'Membership',
      triggerId: TRG,
      status: 'failed',
      pageSize: '5',
    })
  })

  it('refuses a trigger type the gateway does not have', async () => {
    const {error} = await runCommand(['trigger', 'runs', 'Webhook', TRG, ...globalArgs])
    expect(error?.oclif?.exit).toBe(2)
    expect(calls).toHaveLength(0)
  })

})

describe('trigger run', () => {
  it('with --type reads once, the id in the path and the type on the query', async () => {
    answers = [{status: 200, body: {item: {runId: RUN, status: 'succeeded'}}}]
    const {error} = await runCommand(['trigger', 'run', RUN, '--type', 'Payments', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]!.path).toBe(`/v3/triggers/runs/${RUN}`)
    expect(calls[0]!.query.get('triggerType')).toBe('Payments')
  })

  it('without --type walks the types past a 404 and a 403 and stops at the run', async () => {
    answers = [notFound, {status: 403, body: {}}, {status: 200, body: {item: {runId: RUN, status: 'failed'}}}]
    const {error} = await runCommand(['trigger', 'run', RUN, ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls.map((c) => c.query.get('triggerType'))).toEqual(['Membership', 'Schema', 'Files'])
  })

  it('without --type answers not found after all five types', async () => {
    answers = [notFound, notFound, notFound, notFound, notFound]
    const {error} = await runCommand(['trigger', 'run', RUN, ...globalArgs])
    expect(calls).toHaveLength(5)
    expect(error?.oclif?.exit).toBe(5)
  })

  it('stops at a failure that is not about the type', async () => {
    answers = [{status: 400, body: {responseStatus: {errors: [{errorCode: 'CM-ERRORS-TRIGGERS-023', message: 'bad id'}]}}}]
    const {error} = await runCommand(['trigger', 'run', 'nope', ...globalArgs])
    expect(calls).toHaveLength(1)
    expect(error?.oclif?.exit).toBe(6)
  })
})

describe('identities', () => {
  it('list reads the identities', async () => {
    answers = [{status: 200, body: {identities: [{id: 'usr_1', name: 'Project triggers', isDefault: true, status: 'Active', canAssign: true}]}}]
    await runCommand(['identities', 'list', ...globalArgs])
    expect(calls[0]!.method).toBe('GET')
    expect(calls[0]!.path).toBe('/v3/membership/execution-identities')
  })

  it('create sends the name and every role', async () => {
    answers = [{status: 200, body: {id: 'usr_2'}}]
    await runCommand(['identities', 'create', '--name', 'Bot', '--role', 'Editor', '--role', 'Mailer', ...globalArgs])
    expect(calls[0]!.method).toBe('POST')
    expect(calls[0]!.body).toEqual({name: 'Bot', roleIds: ['Editor', 'Mailer']})
  })

  it('create --dry-run sends nothing', async () => {
    await runCommand(['identities', 'create', '--name', 'Bot', '--dry-run', ...globalArgs])
    expect(calls).toHaveLength(0)
  })
})

describe('--execution-identity', () => {
  it('db trigger create puts it on the trigger', async () => {
    await runCommand(['db', 'trigger', 'create', '--file', triggerFile(), '--execution-identity', 'usr_1', ...globalArgs])
    expect((calls[0]!.body!.trigger as Record<string, unknown>).executionIdentityId).toBe('usr_1')
  })

  it('payments trigger save takes the word default', async () => {
    await runCommand(['payments', 'trigger', 'save', '--file', triggerFile(), '--execution-identity', 'default', ...globalArgs])
    expect((calls[0]!.body!.trigger as Record<string, unknown>).executionIdentityId).toBe('default')
  })

  it('leaves the file alone when the flag is not given', async () => {
    await runCommand(['db', 'trigger', 'create', '--file', triggerFile(), ...globalArgs])
    expect(calls[0]!.body!.trigger).not.toHaveProperty('executionIdentityId')
  })
})

describe('template warnings', () => {
  it('no warnings, nothing on stderr', () => {
    const lines: string[] = []
    printTemplateWarnings({id: 'tpl_1'}, (t) => lines.push(t))
    expect(lines).toEqual([])
    expect(templateWarnings({warnings: ['a', 1, '']})).toEqual(['a'])
  })
})

describe('formatters', () => {
  it('a run list names who it ran as and what it produced', () => {
    const text = formatTriggerRuns({
      list: {
        items: [{runId: RUN, event: 'OnInsert', action: 'Email', status: 'failed', error: 'no template', executionIdentityIsDefault: true, produced: {kind: 'EmailCampaign', id: 'cmp_1'}}],
        hasMore: true,
        startingAfter: RUN,
      },
    })
    expect(text).toContain('failed — no template')
    expect(text).toContain('Project triggers (default)')
    expect(text).toContain('EmailCampaign cmp_1')
    expect(text).toContain(`--after ${RUN}`)
  })

  it('stats name the blocked and the removed', () => {
    const text = formatCampaignStats({stats: {sent: 9, blocked: 3, removedRecipients: 2}})
    expect(text).toMatch(/Blocked:\s+3/)
    expect(text).toMatch(/Removed:\s+2/)
  })

  it('an empty list says the runs are kept 30 days', () => {
    expect(formatTriggerRuns({list: {items: []}})).toContain('30 days')
  })

  it('one run leaves out what it does not have', () => {
    const text = formatTriggerRun({item: {runId: RUN, status: 'skipped', missingPermissions: ['email:create']}})
    expect(text).toContain('email:create')
    expect(text).not.toContain('Finished')
  })

  it('an identity shows its use', () => {
    const text = formatIdentities({identities: [{id: 'usr_1', name: 'Bot', canAssign: false, usedBy: {triggers: 2, tasks: 1, workflows: 0}}]})
    expect(text).toContain('2 triggers · 1 tasks · 0 workflows')
  })

  it('stats without an answer say so', () => {
    expect(formatCampaignStats({})).toBe('No statistics yet.')
  })
})
