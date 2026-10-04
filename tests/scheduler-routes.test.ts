import {readFileSync} from 'node:fs'

import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

/**
 * Every scheduler command, run the way a user types it, through oclif and the
 * real `@norbix.ai/ts` transport, with `fetch` replaced: the verb, the path,
 * the query and the body it sends. Nothing leaves the process; no e-mail is
 * sent by any test.
 */

const ID = '66b2f0a1'
const TEMPLATE = '7c3d9e10'
const INITIATOR = 'usr_5a1b'

interface Call {
  method: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

let calls: Call[]
let realFetch: typeof globalThis.fetch

beforeEach(() => {
  calls = []
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push({
      method: init?.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
    })
    return new Response(JSON.stringify({id: ID}), {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

const P = '/v2/scheduler'

/**
 * Module enable / disable: the gateway moved them to PUT; `@norbix.ai/ts`
 * sends PUT from 4.6.0 on (GET before). The CLI calls the SDK method, so the
 * verb follows the installed SDK — this row stays true across the bump.
 */
const sdkVersion = (
  JSON.parse(
    // The package's `exports` hide package.json, so read it from node_modules.
    readFileSync(new URL('../node_modules/@norbix.ai/ts/package.json', import.meta.url), 'utf8'),
  ) as {version: string}
).version
const [major, minor] = sdkVersion.split('.').map(Number)
const MODULE_VERB = major > 4 || (major === 4 && minor >= 6) ? 'PUT' : 'GET'

/** A cron as one argv item: @oclif/test's runCommand splits on spaces outside quotes. */
const CRON = '"0 9 * * 1"'

/** The email provider — every campaign names one; the server never falls back (CM-ERRORS-INTEGRATIONS-003). */
const INTEGRATION = 'int_1'

/** The flags every `scheduler save` needs. */
const SAVE = ['--name', 'Weekly', '--cron', CRON, '--initiator', INITIATOR, '--template', TEMPLATE, '--integration', INTEGRATION, '--audience', 'all-users', '--yes']

/** [argv, verb, path] — argv without the leading `norbix`. */
const routes: Array<[string[], string, string]> = [
  [['module', 'enable', 'scheduler'], MODULE_VERB, `${P}/enable`],
  [['module', 'disable', 'scheduler', '--yes'], MODULE_VERB, `${P}/disable`],
  [['scheduler', 'list'], 'GET', `${P}/tasks`],
  [['scheduler', 'get', ID], 'GET', `${P}/tasks/${ID}`],
  [['scheduler', 'enable', ID, '--yes'], 'PUT', `${P}/tasks/${ID}/enable`],
  [['scheduler', 'disable', ID, '--yes'], 'PUT', `${P}/tasks/${ID}/disable`],
  [['scheduler', 'delete', ID, '--yes'], 'DELETE', `${P}/tasks/${ID}`],
  [['scheduler', 'save', ...SAVE], 'POST', `${P}/tasks`],
]

describe('every scheduler command reaches its route', () => {
  for (const [argv, verb, path] of routes) {
    it(`${argv.join(' ')} → ${verb} ${path}`, async () => {
      const {error} = await runCommand([...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe(verb)
      expect(calls[0]?.path).toBe(path)
    })
  }
})

it('covers all 8 scheduler routes', () => {
  expect(new Set(routes.map(([, verb, path]) => `${verb} ${path}`)).size).toBe(8)
})

/** Run a command and return the one request it sent. */
async function callOf(argv: string[]): Promise<Call> {
  const {error} = await runCommand([...argv, ...globalArgs])
  expect(error).toBeUndefined()
  expect(calls).toHaveLength(1)
  return calls[0] as Call
}

describe('scheduler list', () => {
  it('sends no filter by default', async () => {
    const call = await callOf(['scheduler', 'list'])
    expect(call.query.has('type')).toBe(false)
    expect(call.query.has('enabled')).toBe(false)
    expect(call.body).toBeUndefined()
  })

  it('puts --type, --enabled and the paging flags in the query', async () => {
    const call = await callOf(['scheduler', 'list', '--type', 'EmailCampaign', '--enabled', '--page-size', '20', '--after', ID])
    expect(Object.fromEntries(call.query)).toEqual({type: 'EmailCampaign', enabled: 'true', pageSize: '20', startingAfter: ID})
  })

  it('--no-enabled asks for the disabled tasks', async () => {
    const call = await callOf(['scheduler', 'list', '--no-enabled'])
    expect(call.query.get('enabled')).toBe('false')
  })

  it('rejects a type the gateway does not know', async () => {
    const {error} = await runCommand(['scheduler', 'list', '--type', 'Nope', ...globalArgs])
    expect(error?.message).toMatch(/Expected --type=Nope to be one of/)
    expect(calls).toHaveLength(0)
  })
})

describe('scheduler task id commands put the id in the path only', () => {
  for (const [argv, verb] of [
    [['get', ID], 'GET'],
    [['enable', ID, '--yes'], 'PUT'],
    [['disable', ID, '--yes'], 'PUT'],
    [['delete', ID, '--yes'], 'DELETE'],
  ] as Array<[string[], string]>) {
    it(`scheduler ${argv[0]}`, async () => {
      const call = await callOf(['scheduler', ...argv])
      expect(call.method).toBe(verb)
      expect(call.path.startsWith(`${P}/tasks/${ID}`)).toBe(true)
      expect([...call.query.keys()]).toEqual([])
      // A JSON body, if the transport sends one, carries no task fields.
      expect(call.body?.name).toBeUndefined()
    })
  }
})

describe('scheduler save', () => {
  it('creates a task: the exact body, task type EmailCampaign, campaign to all users', async () => {
    const call = await callOf(['scheduler', 'save', ...SAVE])
    expect(call.method).toBe('POST')
    expect(call.path).toBe(`${P}/tasks`)
    expect(call.body).toEqual({
      name: 'Weekly',
      cron: '0 9 * * 1',
      initiatorUserId: INITIATOR,
      isEnabled: true,
      stopOnError: false,
      task: {
        type: 'EmailCampaign',
        campaign: {source: 'AllUsers', templateId: TEMPLATE, integrationId: INTEGRATION},
      },
    })
  })

  it('updates a task with --id: taskId in the body, every other flag mapped', async () => {
    const call = await callOf([
      'scheduler', 'save', '--id', ID, '--name', 'Weekly', '--description', 'Mondays', '--cron', CRON,
      '--initiator', INITIATOR, '--no-enabled', '--stop-on-error', '--template', TEMPLATE,
      '--audience', 'emails', '--email', 'ada@example.com', '--email', 'bob@example.com', '--cc', 'cc@example.com',
      '--one-each', '--integration', 'int_1', '--validation-integration', 'val_1', '--language', 'de',
      '--on-behalf-of', 'usr_7', '--notes', 'n', '--token', 'Name=Ada', '--database-integration', 'db_1',
      '--config', '{"templateId":"ignored","recipientsBcc":["x@example.com"]}', '--yes',
    ])
    expect(call.method).toBe('POST')
    expect(call.path).toBe(`${P}/tasks`)
    expect(call.body).toEqual({
      taskId: ID,
      name: 'Weekly',
      description: 'Mondays',
      cron: '0 9 * * 1',
      initiatorUserId: INITIATOR,
      isEnabled: false,
      stopOnError: true,
      task: {
        type: 'EmailCampaign',
        databaseIntegrationId: 'db_1',
        campaign: {
          source: 'Email',
          templateId: TEMPLATE,
          integrationId: 'int_1',
          validationIntegrationId: 'val_1',
          language: 'de',
          initiatorId: 'usr_7',
          notes: 'n',
          mappedTokens: [{key: 'Name', value: 'Ada', resolver: 'Custom'}],
          recipients: ['ada@example.com', 'bob@example.com'],
          recipientsCc: ['cc@example.com'],
          // --config is merged in; a flag wins over the same key in --config,
          // and a key no flag sets (or one whose flag is left out) is kept.
          recipientsBcc: ['x@example.com'],
          singleEmailStrategy: true,
        },
      },
    })
  })

  it('sends the all-users narrowing flags as rolesNames / userTags', async () => {
    const call = await callOf(['scheduler', 'save', ...SAVE, '--role', 'Admin', '--tag', 'beta'])
    expect((call.body?.task as {campaign: unknown}).campaign).toEqual({
      source: 'AllUsers',
      templateId: TEMPLATE,
      integrationId: INTEGRATION,
      rolesNames: ['Admin'],
      userTags: ['beta'],
    })
  })

  it('returns the saved task id (printed as "Task <id> saved.", the JSON with --json)', async () => {
    const {result, error} = await runCommand(['scheduler', 'save', ...SAVE, ...globalArgs])
    expect(error).toBeUndefined()
    expect(result).toEqual({id: ID})
  })

  it.each([
    ['"0 9 * *"', 4],
    ['"0 0 9 * * 1"', 6],
    ['@daily', 1],
  ])('rejects --cron %s (%i fields) before sending anything', async (cron, count) => {
    const argv = [...SAVE]
    argv[argv.indexOf(CRON)] = cron
    const {error} = await runCommand(['scheduler', 'save', ...argv, ...globalArgs])
    expect(error?.message).toContain(`--cron needs 5 fields (minute hour day-of-month month day-of-week), got ${count}`)
    expect(calls).toHaveLength(0)
  })

  it.each([
    ['users', [], /needs at least one --user/],
    ['emails', [], /needs at least one --email/],
    ['collection', ['--schema', 's'], /needs --schema and --field/],
  ])('--audience %s without its recipients fails before sending', async (audience, extra, message) => {
    const argv = [...SAVE]
    argv[argv.indexOf('all-users')] = audience
    const {error} = await runCommand(['scheduler', 'save', ...argv, ...extra, ...globalArgs])
    expect(error?.message).toMatch(message)
    expect(calls).toHaveLength(0)
  })

  it('refuses a missing --integration before any request (the task sends an email campaign)', async () => {
    const argv = SAVE.filter((a) => a !== '--integration' && a !== INTEGRATION)
    const {error} = await runCommand(['scheduler', 'save', ...argv, ...globalArgs])
    expect(error?.message).toMatch(/Missing required flag integration/)
    expect(calls).toHaveLength(0)
  })

  it('--on-behalf-of wins over an initiatorId in --config', async () => {
    const call = await callOf(['scheduler', 'save', ...SAVE, '--on-behalf-of', 'usr_7', '--config', '{"initiatorId":"usr_9"}'])
    expect((call.body?.task as {campaign: Record<string, unknown>}).campaign.initiatorId).toBe('usr_7')
  })

  it('requires --name, --cron, --initiator, --template, --integration and --audience', async () => {
    const {error} = await runCommand(['scheduler', 'save', '--yes', ...globalArgs])
    for (const flag of ['name', 'cron', 'initiator', 'template', 'integration', 'audience']) {
      expect(error?.message).toContain(`Missing required flag ${flag}`)
    }

    expect(calls).toHaveLength(0)
  })

  it('--dry-run sends nothing', async () => {
    const argv = SAVE.filter((a) => a !== '--yes')
    const {error} = await runCommand(['scheduler', 'save', ...argv, '--dry-run', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
  })
})
