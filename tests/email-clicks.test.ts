import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {runCommand as runOclif} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {batches, parseClicksFile, parseCsv, summarize} from '../src/lib/email-clicks.js'
import {envListAnswer} from './_env.js'

/**
 * `email click-tracking` and `email clicks import` (gateway
 * docs/tasks/email-tracking-links.md), run the way a user types them,
 * through oclif and the real `@norbix.ai/ts` transport. `fetch` is replaced,
 * so nothing leaves the process; the clicks answer is computed per request
 * so batching and row numbers are checked on the wire.
 */

interface Call {
  method: string
  path: string
  body?: Record<string, unknown>
}

interface Click {
  nblid: string
  url?: string
  clickedAt?: string
  userAgent?: string
}

let calls: Call[]
let realFetch: typeof globalThis.fetch
/** The project the GET answers with. */
let project: Record<string, unknown>
/** Which clicks call (0-based) answers 500, if any. */
let failOnCall: number | undefined

/** The gateway's clicks answer: an nblid starting with `bad` is rejected not-valid, `dup` is duplicate, `bot` is flagged. */
function clicksAnswer(clicks: Click[]): Record<string, unknown> {
  const results = clicks.map((c, index) =>
    c.nblid.startsWith('bad')
      ? {index, status: 'rejected', reason: 'not-valid'}
      : c.nblid.startsWith('dup')
        ? {index, status: 'duplicate', campaignId: 'cmp_1', notificationId: 'ntf_1', linkIndex: 0, to: ['ada@example.com']}
        : {
            index,
            status: 'recorded',
            campaignId: 'cmp_1',
            notificationId: 'ntf_1',
            linkIndex: 0,
            to: ['ada@example.com'],
            ...(c.nblid.startsWith('bot') ? {flag: 'suspected-scanner', flagReason: 'user-agent'} : {}),
          },
  )
  return {
    recorded: results.filter((r) => r.status === 'recorded').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    flagged: results.filter((r) => 'flag' in r).length,
    rejected: results.filter((r) => r.status === 'rejected').length,
    clicks: results,
  }
}

beforeEach(() => {
  calls = []
  project = {}
  failOnCall = undefined
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const envList = envListAnswer(input, init)
    if (envList) return envList
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined
    calls.push({method: init?.method ?? 'GET', path: url.pathname, body})
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}})
    if (url.pathname.endsWith('/notifications/email/clicks')) {
      const n = calls.filter((c) => c.path.endsWith('/notifications/email/clicks')).length - 1
      if (n === failOnCall) return json({responseStatus: {errorCode: 'CM-ERRORS-INTERNAL', message: 'boom'}}, 500)
      return json(clicksAnswer((body?.clicks ?? []) as Click[]))
    }

    if (url.pathname.startsWith('/v3/account/projects/')) return json({item: project})
    return json({})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']
const CLICKS = '/v3/notifications/email/clicks'
const SWITCH = '/v3/notifications/email/settings/click-tracking'

/** Write a file into a fresh temp folder (no spaces: @oclif/test splits argv on them). */
function file(name: string, content: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'norbix-clicks-')), name)
  writeFileSync(path, content)
  return path
}

/**
 * Run a command and capture what it prints. oclif's `this.log` goes through
 * `console.log`, which vitest intercepts before @oclif/test sees it, so it is
 * captured here; the stderr notes are `process.stderr.write` (captured by @oclif/test).
 */
async function runCommand(argv: string[]): Promise<{error?: Error; stdout: string; stderr: string; result?: unknown}> {
  const lines: string[] = []
  const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '))
  })
  try {
    const r = await runOclif(argv)
    return {error: r.error, stdout: lines.map((l) => `${l}\n`).join('') + r.stdout, stderr: r.stderr, result: r.result}
  } finally {
    spy.mockRestore()
  }
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

describe('email click-tracking', () => {
  it('with no flag shows the project value and the warning, sends no switch', async () => {
    project = {id: 'test-project', emailClickTracking: true}
    const {error, stdout, stderr} = await runCommand(['email', 'click-tracking', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({method: 'GET', path: '/v3/account/projects/test-project'})
    expect(stdout.trim()).toBe('Email click ids: on.')
    expect(stderr).toMatch(/Warning: Clicks come back only from sites you own/)
  })

  it('reads a project without the field as off', async () => {
    const {stdout} = await runCommand(['email', 'click-tracking', ...globalArgs])
    expect(stdout.trim()).toBe('Email click ids: off.')
  })

  it('--json is one document with the value and the warning', async () => {
    project = {emailClickTracking: false}
    const {stdout} = await runCommand(['email', 'click-tracking', '--json', ...globalArgs])
    expect(JSON.parse(stdout)).toEqual({
      projectId: 'test-project',
      emailClickTracking: false,
      warning: expect.stringMatching(/only from sites you own/),
    })
  })

  it('--on sends PATCH {enabled: true}; --off sends {enabled: false}', async () => {
    const on = await runCommand(['email', 'click-tracking', '--on', ...globalArgs])
    expect(on.error).toBeUndefined()
    expect(on.stdout.trim()).toBe('Email click ids switched: on.')
    expect(on.stderr).toMatch(/only from sites you own/)
    const off = await runCommand(['email', 'click-tracking', '--off', ...globalArgs])
    expect(off.error).toBeUndefined()
    expect(calls).toEqual([
      {method: 'PATCH', path: SWITCH, body: {enabled: true}},
      {method: 'PATCH', path: SWITCH, body: {enabled: false}},
    ])
  })

  it('refuses --on with --off and sends nothing', async () => {
    const {error} = await runCommand(['email', 'click-tracking', '--on', '--off', ...globalArgs])
    expect(error?.message).toMatch(/cannot also be provided/)
    expect(calls).toHaveLength(0)
  })

  it('--dry-run sends nothing', async () => {
    const {error, stdout} = await runCommand(['email', 'click-tracking', '--on', '--dry-run', ...globalArgs])
    expect(error).toBeUndefined()
    expect(stdout).toMatch(/Dry run — nothing was sent/)
    expect(stdout).toMatch(/PATCH .*\/notifications\/email\/settings\/click-tracking/)
    expect(calls).toHaveLength(0)
  })
})

describe('email clicks import', () => {
  it('sends a CSV whose user agent holds commas and quotes, and prints the totals', async () => {
    const csv = [
      'nblid,url,clickedAt,userAgent',
      `ntf_a.0.1.m,https://shop.example.com/a?x=1,2026-11-11T10:00:00Z,"${UA}"`,
      'bot_b.1.1.m,"https://shop.example.com/b,c",2026-11-11T10:00:01Z,"say ""hi"""',
      '',
    ].join('\r\n')
    const {error, stdout, stderr} = await runCommand(['email', 'clicks', 'import', file('clicks.csv', csv), ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({method: 'POST', path: CLICKS})
    expect(calls[0]?.body).toEqual({
      clicks: [
        {nblid: 'ntf_a.0.1.m', url: 'https://shop.example.com/a?x=1', clickedAt: '2026-11-11T10:00:00Z', userAgent: UA},
        {nblid: 'bot_b.1.1.m', url: 'https://shop.example.com/b,c', clickedAt: '2026-11-11T10:00:01Z', userAgent: 'say "hi"'},
      ],
    })
    expect(stdout).toContain('Sent 2 clicks in 1 batch.')
    expect(stdout).toContain('recorded: 2  duplicates: 0  flagged: 1  rejected: 0')
    expect(stdout).not.toContain('Rejected:')
    expect(stderr).toBe('')
  })

  it('takes the columns in any order and case, and only nblid', async () => {
    const {error} = await runCommand(['email', 'clicks', 'import', file('c.csv', 'URL,NBLID\nhttps://a.example.com,ntf_1\n,ntf_2\n'), ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls[0]?.body).toEqual({clicks: [{url: 'https://a.example.com', nblid: 'ntf_1'}, {nblid: 'ntf_2'}]})
  })

  it('reads a JSON array, and the request body {clicks: [...]}', async () => {
    const clicks = [{nblid: 'ntf_1', clickedAt: '2026-11-11T10:00:00Z'}, {nblid: 'dup_2', url: 'https://a.example.com', clickedAt: '2026-11-11T10:00:00Z'}]
    await runCommand(['email', 'clicks', 'import', file('c.json', JSON.stringify(clicks)), ...globalArgs])
    await runCommand(['email', 'clicks', 'import', file('c.json', JSON.stringify({clicks})), ...globalArgs])
    expect(calls.map((c) => c.body)).toEqual([{clicks}, {clicks}])
  })

  it('sends batches of 500 and numbers a rejected row by its place in the file', async () => {
    const rows = Array.from({length: 1001}, (_, i) => ({nblid: i === 503 || i === 1000 ? `bad_${i}` : `ntf_${i}`, clickedAt: '2026-11-11T10:00:00Z'}))
    const {error, stdout} = await runCommand(['email', 'clicks', 'import', file('c.json', JSON.stringify(rows)), ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls.map((c) => (c.body?.clicks as unknown[]).length)).toEqual([500, 500, 1])
    expect((calls[1]?.body?.clicks as Click[])[0]?.nblid).toBe('ntf_500')
    expect(stdout).toContain('Sent 1001 clicks in 3 batches.')
    expect(stdout).toContain('recorded: 999  duplicates: 0  flagged: 0  rejected: 2')
    expect(stdout).toContain('Rejected:\n  row 504  bad_503  not-valid\n  row 1001  bad_1000  not-valid')
  })

  it('--json prints the totals, the rejected rows and the raw answer of every batch', async () => {
    const rows = [{nblid: 'ntf_1'}, {nblid: 'bad_2'}, {nblid: 'dup_3'}]
    const {stdout} = await runCommand(['email', 'clicks', 'import', file('c.json', JSON.stringify(rows)), '--json', ...globalArgs])
    const out = JSON.parse(stdout)
    expect(out).toMatchObject({
      clicks: 3,
      batches: 1,
      recorded: 1,
      duplicates: 1,
      flagged: 0,
      rejected: 1,
      rejectedRows: [{row: 2, nblid: 'bad_2', reason: 'not-valid'}],
    })
    expect(out.answers).toHaveLength(1)
    expect(out.answers[0].clicks[2]).toMatchObject({index: 2, status: 'duplicate', to: ['ada@example.com']})
  })

  it('prints no note for rows with no clickedAt (the gateway answers duplicate for them on a re-run)', async () => {
    const {stderr} = await runCommand(['email', 'clicks', 'import', file('c.csv', 'nblid,clickedAt\nntf_1,\nntf_2,2026-11-11T10:00:00Z\n'), ...globalArgs])
    expect(stderr).not.toMatch(/no clickedAt/)
  })

  it('hints at --project / --env when every click id is not valid', async () => {
    const {stdout, stderr} = await runCommand(['email', 'clicks', 'import', file('c.csv', 'nblid,clickedAt\nbad_1,2026-11-11T10:00:00Z\nbad_2,2026-11-11T10:00:00Z\n'), ...globalArgs])
    expect(stdout).toContain('Rejected:\n  row 1  bad_1  not-valid\n  row 2  bad_2  not-valid')
    expect(stderr).toMatch(/valid only in the project and environment that sent the email/)
  })

  const refused: Array<[string, string, string, RegExp]> = [
    ['an empty file', 'c.csv', '', /The file is empty/],
    ['a blank file', 'c.json', '  \n\n', /The file is empty/],
    ['a CSV with only the header', 'c.csv', 'nblid,url\n', /The file has no clicks/],
    ['an empty JSON array', 'c.json', '[]', /The file has no clicks/],
    ['a CSV row with no nblid', 'c.csv', 'nblid,url\nntf_1,https://a.example.com\n,https://b.example.com\n', /row 2: no nblid/],
    ['a JSON row with no nblid', 'c.json', '[{"nblid":"ntf_1"},{"url":"https://b.example.com"}]', /row 2: no nblid/],
    ['a CSV with no nblid column', 'c.csv', 'url\nhttps://a.example.com\n', /no nblid column/],
    ['an unknown CSV column', 'c.csv', 'nblid,clicked_at\nntf_1,2026-11-11\n', /Unknown CSV column: "clicked_at"/],
    ['an unknown JSON field', 'c.json', '[{"nblid":"ntf_1","when":"now"}]', /row 1: unknown field "when"/],
    ['a clickedAt that is not a time', 'c.csv', 'nblid,clickedAt\nntf_1,yesterday\n', /row 1: clickedAt "yesterday" is not a time/],
    ['JSON that is not an array', 'c.json', '{"nblid":"ntf_1"}', /not an array of clicks/],
    ['broken JSON', 'c.json', '[{"nblid":', /not valid JSON/],
    ['an unclosed quote', 'c.csv', 'nblid,userAgent\nntf_1,"Mozilla\n', /closing " is missing/],
  ]

  for (const [what, name, content, message] of refused) {
    it(`refuses ${what} before sending anything (exit 2)`, async () => {
      const {error} = await runCommand(['email', 'clicks', 'import', file(name, content), ...globalArgs])
      expect(error?.message).toMatch(message)
      expect((error as {oclif?: {exit?: number}} | undefined)?.oclif?.exit).toBe(2)
      expect(calls).toHaveLength(0)
    })
  }

  it('refuses a bad row under --dry-run too', async () => {
    const {error} = await runCommand(['email', 'clicks', 'import', file('c.csv', 'nblid\n\n""\n'), '--dry-run', ...globalArgs])
    expect(error?.message).toMatch(/The file has no clicks|no nblid/)
    expect(calls).toHaveLength(0)
  })

  it('refuses a file that does not exist', async () => {
    const {error} = await runCommand(['email', 'clicks', 'import', '/nonexistent/clicks.csv', ...globalArgs])
    expect(error?.message).toMatch(/Cannot read \/nonexistent\/clicks.csv/)
    expect(calls).toHaveLength(0)
  })

  it('--dry-run prints the first batch and sends nothing', async () => {
    const {error, stdout} = await runCommand(['email', 'clicks', 'import', file('c.csv', 'nblid\nntf_1\n'), '--dry-run', ...globalArgs])
    expect(error).toBeUndefined()
    expect(stdout).toMatch(/Dry run — nothing was sent/)
    expect(stdout).toMatch(/POST .*\/notifications\/email\/clicks/)
    expect(calls).toHaveLength(0)
  })

  it('a failed later batch says how many clicks were sent and that a re-run is safe', async () => {
    failOnCall = 1
    const rows = Array.from({length: 600}, (_, i) => ({nblid: `ntf_${i}`, clickedAt: '2026-11-11T10:00:00Z'}))
    const {error, stdout} = await runCommand(['email', 'clicks', 'import', file('c.json', JSON.stringify(rows)), '--json', ...globalArgs])
    expect((error as {oclif?: {exit?: number}} | undefined)?.oclif?.exit).toBe(8)
    expect(calls).toHaveLength(2)
    const envelope = JSON.parse(stdout).error
    expect(envelope.hint).toMatch(/^500 of 600 clicks were sent before this error\. Running the file again is safe/)
    expect(envelope.context).toMatchObject({sent: 500, total: 600})
  })

  it('a failed first batch is the plain gateway error', async () => {
    failOnCall = 0
    const {error, stdout} = await runCommand(['email', 'clicks', 'import', file('c.csv', 'nblid\nntf_1\n'), '--json', ...globalArgs])
    expect((error as {oclif?: {exit?: number}} | undefined)?.oclif?.exit).toBe(8)
    expect(JSON.parse(stdout).error.hint ?? '').not.toMatch(/were sent before this error/)
  })
})

describe('clicks file helpers', () => {
  it('parseCsv: BOM-free CRLF, blank lines skipped, quoted line breaks kept', () => {
    expect(parseCsv('a,b\r\n\r\n"x\ny",2\n')).toEqual([
      ['a', 'b'],
      ['x\ny', '2'],
    ])
  })

  it('parseClicksFile drops a BOM and trims values', () => {
    expect(parseClicksFile('﻿nblid , url\n ntf_1 , https://a.example.com \n')).toEqual([{nblid: 'ntf_1', url: 'https://a.example.com'}])
  })

  it('batches splits at the size', () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('summarize adds the batch start to the gateway index', () => {
    const clicks = [{nblid: 'a'}, {nblid: 'b'}, {nblid: 'c'}]
    const s = summarize(clicks, [{rejected: 0, clicks: []}, {rejected: 1, clicks: [{index: 0, status: 'rejected', reason: 'in-future'}]}], 2)
    expect(s.rejectedRows).toEqual([{row: 3, nblid: 'c', reason: 'in-future'}])
  })
})
