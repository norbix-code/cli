import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {cli, makeHome, parseSingleJson, pool, startFakeGateway, type FakeGateway} from './_cli.js'

/**
 * The agent contract (docs/agent-contract.md), observed from outside the
 * process: exit codes, one JSON document on stdout, nothing sent without
 * --yes, dry runs that send nothing.
 */

let gateway: FakeGateway
let home: string

beforeAll(async () => {
  gateway = await startFakeGateway()
  home = makeHome(gateway.port)
})

afterAll(async () => {
  await gateway.close()
})

beforeEach(() => {
  gateway.hits.length = 0
})

/** Every destructive command, with the arguments it needs — without --yes. */
const DESTRUCTIVE: string[][] = [
  ['users', 'delete', 'abc123'],
  ['users', 'block', 'abc123'],
  ['sms', 'delete', 'abc123'],
  ['sms', 'stop', 'abc123'],
  ['email', 'delete', 'abc123'],
  ['email', 'stop', 'abc123'],
  ['push', 'delete', 'abc123'],
  ['push', 'stop', 'abc123'],
  ['push', 'disable'],
  ['push', 'campaign', 'delete', 'abc123'],
  ['push', 'integration', 'delete', 'abc123'],
  ['push', 'integration', 'disable', 'abc123'],
  ['files', 'delete', 'invoices/2026/invoice.pdf', '--integration', 'fi_1'],
  ['scheduler', 'delete', 'abc123'],
  ['scheduler', 'disable', 'abc123'],
  ['scheduler', 'enable', 'abc123'],
  ['scheduler', 'save', '--name', 'Weekly', '--cron', '0 9 * * 1', '--initiator', 'usr_1', '--template', 'abc123', '--integration', 'int_1', '--audience', 'all-users'],
  ['env', 'delete', 'STAGING'],
  ['apikeys', 'regenerate', 'aisu_1', 'aisk_1'],
  ['apikeys', 'revoke', 'aisu_1', 'aisk_1'],
  ['webhooks', 'remove', 'abc123'],
  ['webhooks', 'disable', 'abc123'],
  ['webhooks', 'secret', '--rotate'],
  ['payments', 'disable', 'abc123'],
  ['module', 'disable', 'sms'],
  ['db', 'delete', 'orders', '--id', 'abc123'],
  ['db', 'delete', 'orders', '--many', '--filter', '{"a":1}'],
  ['db', 'delete', 'orders', '--all'],
  ['db', 'update', 'orders', '--many', '--filter', '{"a":1}', '--update', '{"a":2}'],
  ['db', 'update', 'orders', '--all', '--update', '{"a":2}'],
  ['api', 'membership', 'user', 'delete', 'abc123'],
  ['hub', 'scheduler', 'task', 'delete', 'abc123'],
  ['ai', 'llm', 'delete', 'abc123'],
  ['ai', 'llm', 'disable', 'abc123'],
  ['ai', 'mcp', 'delete', 'abc123'],
  ['ai', 'mcp', 'disable', 'abc123'],
  ['ai', 'service-user', 'delete', 'abc123'],
  ['ai', 'service-user', 'revoke-key', 'abc123', 'key_1'],
  ['email', 'disable'],
  ['email', 'campaign', 'delete', 'abc123'],
  ['email', 'footer', 'delete', 'abc123'],
  ['email', 'signature', 'delete', 'abc123'],
  ['email', 'integration', 'delete', 'abc123'],
  ['email', 'integration', 'disable', 'abc123'],
  ['sms', 'disable'],
  ['sms', 'campaign', 'delete', 'abc123'],
  ['sms', 'integration', 'delete', 'abc123'],
  ['sms', 'integration', 'disable', 'abc123'],
  ['project', 'delete'],
  ['project', 'disable'],
  ['project', 'admin-portal', 'disable'],
  ['project', 'ai', 'assistant', 'delete', 'abc123'],
]

describe('destructive commands in a non-interactive shell', () => {
  // Each test spawns the CLI once per command (DESTRUCTIVE.length processes,
  // 4 at a time). Windows runners need ~3 s per spawn, so the default 20 s
  // runs out — and a timed-out pool keeps sending into the next test.
  const SPAWN_ALL_TIMEOUT = 120_000

  it('every one exits 3 without --yes and sends nothing', async () => {
    const results = await pool(DESTRUCTIVE, 4, async (argv) => ({argv, ...(await cli(home, [...argv, '--profile', 'x']))}))
    const wrong = results.filter((r) => r.code !== 3 || !/--yes/.test(r.stderr) || r.stdout !== '')
    expect(wrong.map((r) => `${r.argv.join(' ')} → exit ${r.code}: ${r.stderr.slice(0, 120)}`)).toEqual([])
    expect(gateway.hits).toEqual([])
  }, SPAWN_ALL_TIMEOUT)

  it('every one exits 3 with --json too, with the envelope on stdout', async () => {
    const results = await pool(DESTRUCTIVE, 4, async (argv) => ({argv, ...(await cli(home, [...argv, '--profile', 'x', '--json']))}))
    for (const r of results) {
      expect(r.code, r.argv.join(' ')).toBe(3)
      expect(r.stderr, r.argv.join(' ')).toBe('')
      const doc = parseSingleJson(r.stdout) as {error: {code: string; exit: number; hint: string}}
      expect(doc.error.code).toBe('CONFIRMATION_REQUIRED')
      expect(doc.error.exit).toBe(3)
      expect(doc.error.hint).toMatch(/--yes/)
    }

    expect(gateway.hits).toEqual([])
  }, SPAWN_ALL_TIMEOUT)

  it('every one runs with --yes and reaches the gateway', async () => {
    const results = await pool(DESTRUCTIVE, 4, async (argv) => ({argv, ...(await cli(home, [...argv, '--profile', 'x', '--yes']))}))
    const wrong = results.filter((r) => r.code !== 0)
    expect(wrong.map((r) => `${r.argv.join(' ')} → exit ${r.code}: ${r.stderr.slice(0, 160)}`)).toEqual([])
    expect(gateway.hits.length).toBe(DESTRUCTIVE.length)
  }, SPAWN_ALL_TIMEOUT)
})

describe('--dry-run', () => {
  it('prints the SDK call and the HTTP request, sends nothing, exits 0 (json)', async () => {
    const r = await cli(home, ['users', 'delete', 'abc123', '--profile', 'x', '--dry-run', '--json'])
    expect(r.code).toBe(0)
    expect(r.stderr).toBe('')
    const doc = parseSingleJson(r.stdout) as {dryRun: boolean; method: string; request: unknown; http: {method: string; url: string; headers: Record<string, string>}}
    expect(doc.dryRun).toBe(true)
    expect(doc.method).toBe('api.membership.deleteUser')
    expect(doc.request).toEqual({id: 'abc123'})
    expect(doc.http.method).toBe('DELETE')
    expect(doc.http.url).toMatch(/\/v2\/membership\/auth\?id=abc123$/)
    expect(doc.http.headers.authorization).toBe('Bearer ***')
    expect(gateway.hits).toEqual([])
  })

  it('scheduler save shows the whole task body it would send', async () => {
    const r = await cli(home, [
      'scheduler', 'save', '--name', 'Weekly', '--cron', '0 9 * * 1', '--initiator', 'usr_1',
      '--template', 'abc123', '--integration', 'int_1', '--audience', 'all-users', '--profile', 'x', '--dry-run', '--json',
    ])
    expect(r.code).toBe(0)
    const doc = parseSingleJson(r.stdout) as {method: string; http: {method: string; url: string; body: unknown}}
    expect(doc.method).toBe('hub.scheduler.saveSchedulerTask')
    expect(doc.http.method).toBe('POST')
    expect(doc.http.url).toMatch(/\/v2\/scheduler\/tasks$/)
    expect(doc.http.body).toEqual({
      name: 'Weekly',
      cron: '0 9 * * 1',
      initiatorUserId: 'usr_1',
      isEnabled: true,
      stopOnError: false,
      task: {type: 'EmailCampaign', campaign: {source: 'AllUsers', templateId: 'abc123', integrationId: 'int_1'}},
    })
    expect(gateway.hits).toEqual([])
  })

  it('prints the SDK call in text mode too', async () => {
    const r = await cli(home, ['db', 'update', 'orders', '--many', '--filter', '{"a":1}', '--update', '{"a":2}', '--profile', 'x', '--dry-run'])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('api.database.updateMany')
    expect(r.stdout).toContain('PUT ')
    expect(r.stdout).toContain('"collectionName": "orders"')
    expect(gateway.hits).toEqual([])
  })

  it('works for the plain-word hub/api commands', async () => {
    const r = await cli(home, ['hub', 'scheduler', 'task', 'delete', 'abc123', '--profile', 'x', '--dry-run', '--json'])
    expect(r.code).toBe(0)
    const doc = parseSingleJson(r.stdout) as {method: string; request: unknown}
    expect(doc.method).toBe('hub.scheduler.deleteSchedulerTask')
    expect(doc.request).toEqual({id: 'abc123'})
    expect(gateway.hits).toEqual([])
  })

  it('still resolves the context: a missing region fails', async () => {
    const r = await cli(home, ['users', 'delete', 'abc123', '--profile', 'z', '--dry-run', '--json'])
    expect(r.code).toBe(2)
    const doc = parseSingleJson(r.stdout) as {error: {message: string}}
    expect(doc.error.message).toMatch(/Region is required/)
  })

  it('still resolves the context: missing auth fails with exit 4', async () => {
    const r = await cli(home, ['users', 'delete', 'abc123', '--profile', 'noauth', '--dry-run', '--json'])
    expect(r.code).toBe(4)
    const doc = parseSingleJson(r.stdout) as {error: {code: string}}
    expect(doc.error.code).toBe('UNAUTHENTICATED')
  })
})

interface Case {
  name: string
  argv: string[]
  exit: number
  code: string
  check?: (error: Record<string, unknown>) => void
}

const CASES: Case[] = [
  {
    name: '404 not found',
    argv: ['users', 'get', 'missing', '--profile', 'x'],
    exit: 5,
    code: 'USER_NOT_FOUND',
    check: (e) => {
      expect(e.status).toBe(404)
      expect(e.traceId).toBe('t-1')
      expect(e.url).toMatch(/\/v2\/membership\/auth\/missing$/)
    },
  },
  {
    name: '400 with field errors',
    argv: ['users', 'get', 'bad', '--profile', 'x'],
    exit: 6,
    code: 'NORBIX_VALIDATION_ERROR',
    check: (e) => {
      expect(e.status).toBe(400)
      expect(e.fieldErrors).toEqual({email: ['is required']})
    },
  },
  {
    name: '401 rejected',
    argv: ['users', 'get', 'unauth', '--profile', 'x'],
    exit: 4,
    code: 'NORBIX_AUTH_ERROR',
    check: (e) => expect(e.status).toBe(401),
  },
  {
    name: '500 server error with a trace id',
    argv: ['users', 'get', 'boom', '--profile', 'x'],
    exit: 8,
    code: 'CM-ERRORS-INTERNAL',
    check: (e) => {
      expect(e.status).toBe(500)
      expect(e.traceId).toBe('c-9')
    },
  },
  {
    name: 'network failure',
    argv: ['users', 'list', '--profile', 'y'],
    exit: 7,
    code: 'NORBIX_NETWORK_ERROR',
    check: (e) => expect(e.url).toMatch(/^http:\/\/127\.0\.0\.1:1\//),
  },
  {
    name: 'usage error: missing required flag',
    argv: ['db', 'update', 'orders', '--profile', 'x'],
    exit: 2,
    code: 'USAGE_ERROR',
    check: (e) => expect(e.message).toMatch(/Missing required flag update/),
  },
  {
    name: 'unknown command',
    argv: ['nothing'],
    exit: 2,
    code: 'UNKNOWN_COMMAND',
  },
  {
    name: 'bad --filter JSON',
    argv: ['db', 'find', 'orders', '--filter', '{bad', '--profile', 'x'],
    exit: 2,
    code: 'USAGE_ERROR',
    check: (e) => expect(e.message).toMatch(/--filter is not valid JSON/),
  },
  {
    name: 'unknown profile',
    argv: ['users', 'list', '--profile', 'nope'],
    exit: 2,
    code: 'USAGE_ERROR',
  },
  {
    name: 'login without a terminal',
    argv: ['login', '--project', 'p1'],
    exit: 2,
    code: 'USAGE_ERROR',
    check: (e) => expect(e.hint).toMatch(/--api-key/),
  },
]

describe('error envelope', () => {
  for (const c of CASES) {
    it(`${c.name}: --json gives one document, exit ${c.exit}`, async () => {
      const r = await cli(home, [...c.argv, '--json'])
      expect(r.code).toBe(c.exit)
      expect(r.stderr).toBe('')
      const doc = parseSingleJson(r.stdout) as {error: Record<string, unknown>}
      expect(doc.error.code).toBe(c.code)
      expect(doc.error.exit).toBe(c.exit)
      expect(typeof doc.error.message).toBe('string')
      expect(typeof doc.error.hint).toBe('string')
      expect(typeof doc.error.docs).toBe('string')
      c.check?.(doc.error)
    })

    it(`${c.name}: same exit code without --json, text on stderr only`, async () => {
      const r = await cli(home, c.argv)
      expect(r.code).toBe(c.exit)
      expect(r.stdout).toBe('')
      expect(r.stderr).toMatch(/^Error: /)
      expect(r.stderr).toMatch(/\nHint: /)
      expect(r.stderr).not.toMatch(/\u001B\[/)
      expect(r.stderr).not.toMatch(/at .*\.js:\d+/)
    })
  }

  it('the usage envelope stays short (no parse-context dump)', async () => {
    const r = await cli(home, ['db', 'update', 'orders', '--profile', 'x', '--json'])
    expect(r.stdout.split('\n').length).toBeLessThan(30)
  })
})

describe('plain output', () => {
  it('success with --json is one JSON document and no ANSI codes', async () => {
    const r = await cli(home, ['users', 'get', 'ok1', '--profile', 'x', '--json'])
    expect(r.code).toBe(0)
    expect(r.stderr).toBe('')
    expect(parseSingleJson(r.stdout)).toEqual({ok: true})
    expect(r.stdout).not.toMatch(/\u001B\[/)
  })

  it('a destructive command with --yes prints its text line on stdout', async () => {
    const r = await cli(home, ['users', 'delete', 'abc123', '--profile', 'x', '--yes'])
    expect(r.code).toBe(0)
    expect(r.stdout.trim()).toBe('User abc123 deleted.')
  })
})

describe('--dry-run on non-destructive mutating commands', () => {
  it('users invite: prints the call and sends nothing', async () => {
    const r = await cli(home, ['users', 'invite', 'alice@example.com', '--profile', 'x', '--dry-run', '--json'])
    expect(r.code).toBe(0)
    const doc = parseSingleJson(r.stdout) as {method: string; request: unknown; http: {method: string}}
    expect(doc.method).toBe('api.membership.inviteUser')
    expect(doc.request).toEqual({email: 'alice@example.com'})
    expect(doc.http.method).toBe('POST')
    expect(gateway.hits).toEqual([])
  })

  it('files publish: shows the raw hub request it would send', async () => {
    const r = await cli(home, ['files', 'publish', 'invoices/2026/invoice.pdf', '--integration', 'fi_1', '--profile', 'x', '--dry-run', '--json'])
    expect(r.code).toBe(0)
    const doc = parseSingleJson(r.stdout) as {method: string; http: {method: string; url: string; headers: Record<string, string>; body: unknown}}
    expect(doc.method).toBe('hub.files.makeFilePublic')
    expect(doc.http.method).toBe('POST')
    expect(doc.http.url).toMatch(/\/v2\/files\/item\/public$/)
    expect(doc.http.headers.Authorization).toBe('Bearer ***')
    expect(doc.http.body).toEqual({filesIntegrationId: 'fi_1', path: 'invoices/2026/invoice.pdf'})
    expect(gateway.hits).toEqual([])
  })

  it('config set: shows the file it would write and writes nothing', async () => {
    const r = await cli(home, ['config', 'set', 'region', 'nb-eu-germany', '--dry-run', '--json'])
    expect(r.code).toBe(0)
    const doc = parseSingleJson(r.stdout) as {dryRun: boolean; method: string; request: {key: string; value: string; file: string}}
    expect(doc).toMatchObject({dryRun: true, method: 'config.set', request: {key: 'region', value: 'nb-eu-germany'}})
    const after = await cli(home, ['config', 'get', 'region', '--json'])
    expect(parseSingleJson(after.stdout)).toEqual({profile: 'default', key: 'region'})
  })

  it('hub: a boolean field never swallows the id, a string field keeps its zeros', async () => {
    const r = await cli(home, ['hub', 'email', 'templates', 'get', '--showArchived', 'tpl_1', '--templateId:str', '0042', '--profile', 'x', '--dry-run', '--json'])
    expect(r.code).toBe(0)
    const doc = parseSingleJson(r.stdout) as {request: unknown}
    expect(doc.request).toEqual({showArchived: true, templateId: '0042', id: 'tpl_1'})
  })

  it('hub --body: the whole request as JSON, no mixing with --field', async () => {
    const ok = await cli(home, ['hub', 'scheduler', 'task', 'delete', '--body', '{"id":"abc123"}', '--profile', 'x', '--dry-run', '--json'])
    expect(ok.code).toBe(0)
    expect((parseSingleJson(ok.stdout) as {request: unknown}).request).toEqual({id: 'abc123'})

    const mixed = await cli(home, ['hub', 'scheduler', 'task', 'delete', '--body', '{"id":"abc123"}', '--name', 'x', '--profile', 'x', '--json'])
    expect(mixed.code).toBe(2)
    expect((parseSingleJson(mixed.stdout) as {error: {message: string}}).error.message).toMatch(/--body carries the whole request/)
    expect(gateway.hits).toEqual([])
  })
})
