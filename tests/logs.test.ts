import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {envListAnswer} from './_env.js'

/**
 * Every `norbix logs` command, run the way a user types it, through oclif and
 * the real `@norbix.ai/ts` transport, with `fetch` replaced: the host, verb,
 * path, query and body of the request it sends. Nothing leaves the process.
 *
 * `logs write` goes to the Api host; every other logs command to the Hub.
 */

const ID = '66b2f0a1c3d4e5f6a7b8c9d0'

interface Call {
  method: string
  host: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

/** What the fake gateway answers next: status, JSON body, extra headers. */
interface Answer {
  status: number
  body: unknown
  headers?: Record<string, string>
}

let calls: Call[]
let answer: Answer
let realFetch: typeof globalThis.fetch
let dir: string
/** What the command printed (oclif's log ends in console.log under vitest), joined by newlines. */
let printed: string[]
const out = () => printed.join('\n')

beforeEach(() => {
  printed = []
  vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
    printed.push(parts.join(' '))
  })
  calls = []
  answer = {status: 200, body: {}}
  dir = mkdtempSync(join(tmpdir(), 'norbix-logs-'))
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
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
    })
    return new Response(JSON.stringify(answer.body), {
      status: answer.status,
      headers: {'Content-Type': 'application/json', ...answer.headers},
    })
  }) as typeof globalThis.fetch
})

afterEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = realFetch
  rmSync(dir, {recursive: true, force: true})
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

const P = '/v3/logs'

async function run(argv: string[]) {
  return runCommand(['logs', ...argv, ...globalArgs])
}

describe('logs list', () => {
  it('reads the logs with the default page size', async () => {
    const {error} = await run(['list'])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.host).toMatch(/(^|\.)hub\./)
    expect(calls[0]?.path).toBe(P)
    expect(calls[0]?.query.get('pageSize')).toBe('50')
  })

  it('sends every filter as its query field', async () => {
    const {error} = await run([
      'list',
      '--level', 'Error',
      '--module', 'Database',
      '--search', 'timeout',
      '--event-code', 'db:record:insert',
      '--correlation', 'c-1',
      '--from', '2026-10-20T00:00:00Z',
      '--to', '2026-10-21T00:00:00Z',
      '--page-size', '10',
      '--after', 'cur_1',
    ])

    expect(error).toBeUndefined()
    const q = calls[0]!.query
    expect(Object.fromEntries(q.entries())).toEqual({
      level: 'Error',
      module: 'Database',
      search: 'timeout',
      eventCode: 'db:record:insert',
      logCorrelationId: 'c-1',
      fromUtc: '2026-10-20T00:00:00Z',
      toUtc: '2026-10-21T00:00:00Z',
      pageSize: '10',
      startingAfter: 'cur_1',
    })
  })
})

describe('logs trail', () => {
  it('reads every line of one correlation id', async () => {
    const {error} = await run(['trail', 'c-42'])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe(`${P}/audit`)
    expect(calls[0]?.query.get('targetCorrelationId')).toBe('c-42')
  })

  it('needs the correlation id', async () => {
    const {error} = await run(['trail'])
    expect(error?.message).toMatch(/correlationId/)
    expect(calls).toHaveLength(0)
  })
})

describe('logs get', () => {
  it('reads one entry with the id in the path', async () => {
    answer = {status: 200, body: {item: {id: ID, title: 'Order paid'}}}
    const {error} = await run(['get', ID])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe(`${P}/${ID}`)
    expect(calls[0]?.query.has('id')).toBe(false)
    expect(out()).toContain('Order paid')
  })

  it('needs the id', async () => {
    const {error} = await run(['get'])
    expect(error?.message).toMatch(/id/)
    expect(calls).toHaveLength(0)
  })
})

describe('logs settings', () => {
  it('reads the settings', async () => {
    const {error} = await run(['settings'])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe(`${P}/settings`)
  })
})

describe('logs settings — N48 self-check', () => {
  it('prints the storage warning of the env in plain words', async () => {
    answer = {status: 200, body: {
      env: 'TEST', hasNorbixLogging: false,
      storageWarning: 'TEST has no Norbix Logging integration, so TEST log entries (and scheduler runs) are not stored.',
    }}
    const warned = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    const {error, stderr} = await run(['settings', '--env', 'TEST'])

    expect(error).toBeUndefined()
    expect(out()).toContain('TEST')
    const said = stderr + warned.mock.calls.map((c) => String(c[0])).join('')
    expect(said).toContain('TEST has no Norbix Logging integration')
    warned.mockRestore()
  })
})

describe('logs settings set', () => {
  it('sends only the setting given (absent = unchanged)', async () => {
    const {error} = await run(['settings', 'set', '--skip-body', 'true'])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe(`${P}/settings`)
    expect(calls[0]?.body).toEqual({skipHttpBodyMeta: true})
    expect(out()).toContain('Log settings saved.')
  })

  it('sends all three, false included', async () => {
    const {error} = await run(['settings', 'set', '--skip-cloud', 'false', '--skip-body', 'false', '--ai-chat', 'true'])

    expect(error).toBeUndefined()
    expect(calls[0]?.body).toEqual({skipCloudDashboardLogs: false, skipHttpBodyMeta: false, aiChatLoggingEnabled: true})
  })

  it('refuses with nothing to set', async () => {
    const {error} = await run(['settings', 'set'])
    expect(error?.message).toMatch(/--skip-cloud, --skip-body or --ai-chat/)
    expect(calls).toHaveLength(0)
  })

  it('takes only true or false', async () => {
    const {error} = await run(['settings', 'set', '--ai-chat', 'yes'])
    expect(error?.message).toMatch(/Expected --ai-chat=yes to be one of: true, false/)
    expect(calls).toHaveLength(0)
  })
})

describe('logs clean', () => {
  it('cleans with --yes', async () => {
    const {error} = await run(['clean', '--yes'])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe(`${P}/clean`)
    expect(out()).toContain('Logs cleaned.')
  })

  it('refuses without --yes when there is no terminal, and sends nothing', async () => {
    const {error} = await run(['clean'])
    expect((error as {code?: string} | undefined)?.code).toBe('CONFIRMATION_REQUIRED')
    expect(calls).toHaveLength(0)
  })
})

describe('logs write', () => {
  it('sends one line built from the flags to the Api host and prints the accepted count', async () => {
    answer = {status: 200, body: {accepted: 1}}
    const {error} = await run([
      'write',
      '--title', '"Payment retried"',
      '--level', 'warning',
      '--message', '"Card declined once"',
      '--event-code', 'order:retry',
      '--correlation-id', 'ord_123',
      '--timestamp', '2026-10-21T10:00:00Z',
      '--meta', 'orderId=ord_123',
      '--meta', 'attempt=2',
    ])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.host).toMatch(/(^|\.)api\./)
    expect(calls[0]?.path).toBe(P)
    expect(calls[0]?.body).toEqual({
      entries: [
        {
          title: 'Payment retried',
          level: 'warning',
          message: 'Card declined once',
          eventCode: 'order:retry',
          correlationId: 'ord_123',
          timestamp: '2026-10-21T10:00:00Z',
          meta: {orderId: 'ord_123', attempt: '2'},
        },
      ],
    })
    expect(out()).toContain('accepted: 1')
  })

  it('sends only --title when nothing else is given', async () => {
    answer = {status: 200, body: {accepted: 1}}
    const {error} = await run(['write', '--title', 'Hello'])

    expect(error).toBeUndefined()
    expect(calls[0]?.body).toEqual({entries: [{title: 'Hello'}]})
  })

  it('needs --title (or --file)', async () => {
    const {error} = await run(['write', '--level', 'error'])
    expect(error?.message).toMatch(/--title/)
    expect(calls).toHaveLength(0)
  })

  it('refuses a --meta without =', async () => {
    const {error} = await run(['write', '--title', 'x', '--meta', 'oops'])
    expect(error?.message).toMatch(/key=value/)
    expect(calls).toHaveLength(0)
  })

  it('takes a JSON array from --file (a plain path)', async () => {
    const file = join(dir, 'entries.json')
    const entries = [{title: 'a'}, {title: 'b', level: 'error', meta: {k: 'v'}}]
    writeFileSync(file, JSON.stringify(entries))
    answer = {status: 200, body: {accepted: 2}}

    const {error} = await run(['write', '--file', file])

    expect(error).toBeUndefined()
    expect(calls[0]?.body).toEqual({entries})
    expect(out()).toContain('accepted: 2')
  })

  it('refuses a --file that is not a non-empty JSON array', async () => {
    const file = join(dir, 'entries.json')
    writeFileSync(file, JSON.stringify({title: 'a'}))

    const {error} = await run(['write', '--file', file])
    expect(error?.message).toMatch(/JSON array/)
    expect(calls).toHaveLength(0)
  })

  it('does not take --file together with line flags', async () => {
    const {error} = await run(['write', '--file', join(dir, 'x.json'), '--title', 'x'])
    expect(error?.message).toMatch(/cannot also be provided/)
    expect(calls).toHaveLength(0)
  })

  it('on a 429 says how many seconds to wait (Retry-After)', async () => {
    answer = {
      status: 429,
      body: {responseStatus: {isSuccess: false, errors: [{errorCode: 'CM-ERRORS-LOGGING-003', message: 'Log quota used up.'}]}},
      headers: {'Retry-After': '17'},
    }
    const {error} = await run(['write', '--title', 'x'])

    expect(calls).toHaveLength(1)
    const err = error as {code?: string; status?: number; message?: string; context?: Record<string, unknown>} | undefined
    expect(err?.code).toBe('CM-ERRORS-LOGGING-003')
    expect(err?.status).toBe(429)
    expect(err?.message).toMatch(/Retry after 17 seconds/)
    expect(err?.context).toEqual({retryAfterSeconds: 17})
  })
})
