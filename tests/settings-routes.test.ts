import {existsSync, mkdtempSync, readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * Project settings (matrix section 21): every command of the General info,
 * Languages, Environments, Legal, AI and Billing rows, run the way a
 * user types it through oclif and the real `@norbix.ai/ts` transport. Each
 * row checks the host, the verb and the exact path of every request, in
 * order; the bodies, queries, confirmations and dry runs are checked below.
 *
 * `fetch` is replaced, so nothing leaves the process. The fake answers the
 * environment list (PROD and TEST, so the env commands have a ladder; the
 * project-scoped commands pass --prod), the stored AI plans and an admin URL.
 */

const PROJECT = 'test-project'
const HUB = 'nb-eu-germany.hub.norbix.ai'
const API = 'nb-eu-germany.api.norbix.ai'
const P = `/v3/account/projects/${PROJECT}`
const S = `/v3/account/projects/${PROJECT}/settings`
const E = '/v3/account/projects/environments'
const PLANS = `/v3/account/projects/${PROJECT}/ai/plans`
const CS = 'mongodb+srv://app:secret@cluster0.example.mongodb.net'

interface Call {
  method: string
  host: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

const STORED_PLANS = {
  result: {
    plans: [
      {id: 'aip_free', name: 'Free', quotaUnit: 'Credits', monthlyQuota: 100},
      {
        id: 'aip_pro', name: 'Pro', quotaUnit: 'Credits', monthlyQuota: 5000,
        allowedModels: [{llmIntegrationId: 'int_llm', model: 'gpt-4o'}], features: {attachments: true, memory: false},
      },
    ],
    roles: [{roleId: 'rl_pro', planId: 'aip_pro'}],
    defaultPlanId: 'aip_free',
  },
}

let calls: Call[]
let realFetch: typeof globalThis.fetch
let plansAnswer: unknown
let printed: string[]

beforeEach(() => {
  printed = []
  vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
    printed.push(parts.join(' '))
  })
  calls = []
  plansAnswer = STORED_PLANS
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const method = init?.method ?? 'GET'
    calls.push({
      method,
      host: url.host,
      path: url.pathname,
      query: url.searchParams,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
    })
    let answer: unknown = {}
    if (method === 'GET' && url.pathname === E) answer = {item: {environments: ['PROD', 'TEST'], promotionOrder: ['TEST', 'PROD']}}
    if (method === 'GET' && url.pathname === PLANS) answer = plansAnswer
    if (method === 'GET' && url.pathname.endsWith('/admin-url')) {
      answer = {item: {env: 'TEST', adminUrl: 'https://test-admin.example.com', effectiveAdminUrl: 'https://test-admin.example.com', source: 'environment'}}
    }

    return new Response(JSON.stringify(answer), {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

const globalArgs = ['--project', PROJECT, '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

/** The calls a command made, without the env rule's read of the environment list. */
function sent(argv: string[]): Call[] {
  return argv[0] === 'env' ? calls : calls.filter((c) => !(c.method === 'GET' && c.path === E))
}

type Route = [verb: string, path: string, host?: string]

/** [argv, requests in order] — a read-then-write command sends two. */
const routes: Array<[string[], Route[]]> = [
  // General info
  [['account', 'projects', '--prod'], [['GET', '/v3/account/projects']]],
  [['project', 'create', '--name', 'Shop', '--primary', 'nb-eu-germany', '--connection-string', CS], [['POST', '/v3/account/projects']]],
  // `project` also shows where the e-mail links of the env point
  [['project', '--prod'], [['GET', P], ['GET', `${E}/PROD/admin-url`]]],
  [['project', 'health', '--prod'], [['GET', `${P}/health`]]],
  [['project', 'tokens', '--prod'], [['GET', `${P}/tokens`]]],
  [['project', 'wait-active', '--prod'], [['GET', `${P}/wait-active`]]],

  // Languages
  [['project', 'set-languages', 'en', 'lt', '--prod'], [['PATCH', `${S}/languages`]]],
  [['project', 'set-default-language', 'lt', '--prod'], [['PATCH', `${S}/default-language`]]],
  [['project', 'check-languages', 'en', 'lt', '--prod'], [['POST', `${S}/languages/check`]]],

  // Environments (env management calls skip the env rule)
  [['env', 'list'], [['GET', E]]],
  [['env', 'create', 'STAGING', '--connection-string', CS], [['POST', E]]],
  [['env', 'delete', 'STAGING', '--yes'], [['DELETE', `${E}/STAGING`]]],
  [['env', 'rank', 'STAGING', '2'], [['PATCH', `${E}/STAGING/rank`]]],
  [['env', 'promote', '--from', 'TEST', '--to', 'PROD', '--json'], [['POST', `${E}/promote`]]],
  [['env', 'rollback', '--to', 'PROD', '--version', '279', '--json'], [['POST', `${E}/promote/rollback`]]],
  [['env', 'built-ins', 'repair', '--json'], [['POST', `${E}/built-ins/repair`]]],
  [['env', 'admin-url', 'show', '--env', 'TEST'], [['GET', `${E}/TEST/admin-url`]]],
  [['env', 'admin-url', 'set', 'https://test-admin.example.com', '--env', 'TEST'], [['PATCH', `${E}/TEST/admin-url`], ['GET', `${E}/TEST/admin-url`]]],

  // Legal
  [['project', 'legal', 'set', '--clear-terms', '--clear-privacy', '--prod'], [['PATCH', `${S}/legal`]]],

  // AI settings tab
  [['project', 'ai', 'settings', '--prod'], [['GET', `${P}/ai/settings`]]],
  [['project', 'ai', 'knowledge', 'set', '--embed-files', 'true', '--prod'], [['PUT', `${P}/ai/knowledge`]]],
  [['project', 'ai', 'plans', '--prod'], [['GET', PLANS]]],
  [['project', 'ai', 'plans', 'set', '--plan', '{"name":"Team"}', '--prod'], [['GET', PLANS], ['PUT', PLANS]]],
  [['project', 'ai', 'plans', 'assign', '--default', 'aip_pro', '--prod'], [['GET', PLANS], ['PUT', `${PLANS}/assignments`]]],
  [['project', 'ai', 'usage', '--prod'], [['GET', `${P}/ai/usage`]]],

  // Public config + legal + brand asset (the public reads go to the API host)
  [['project', 'public-config', '--prod'], [['GET', `/v3/public/projects/${PROJECT}/config`, API]]],
  [['project', 'legal', 'show', 'privacy', '--prod'], [['GET', `/v3/public/projects/${PROJECT}/legal/privacy`, API]]],
  [['project', 'brand', 'show', 'logo', '--prod'], [['GET', `/v3/public/projects/${PROJECT}/brand/logo`, API]]],

  // Termination
  [['project', 'disable', '--yes', '--prod'], [['PATCH', `${P}/disable`]]],
  [['project', 'enable', '--prod'], [['PATCH', `${P}/enable`]]],
  [['project', 'delete', '--yes', '--prod'], [['DELETE', P]]],

  // Billing (account level)
  [['account', 'usage', '--prod'], [['GET', '/v3/account/usage-billing']]],
  [['account', 'billing-portal', '--prod'], [['POST', '/v3/account/stripe/get-portal-url']]],
  [['account', 'bundles', '--prod'], [['GET', '/v3/account/stripe/bundles']]],
  [['account', 'change-bundle', '--bundle', 'growth', '--period', 'annual', '--yes', '--prod'], [['POST', '/v3/account/stripe/change-bundle']]],
  [['account', 'discount', 'check', 'LAUNCH30', '--prod'], [['POST', '/v3/account/stripe/discount/check']]],
  [['account', 'discount', 'apply', 'LAUNCH30', '--yes', '--prod'], [['POST', '/v3/account/stripe/discount']]],
]

describe('every project settings command reaches its route', () => {
  for (const [argv, expected] of routes) {
    it(`${argv.join(' ')} → ${expected.map(([verb, path]) => `${verb} ${path}`).join(', ')}`, async () => {
      const {error} = await runCommand([...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(sent(argv).map((c) => [c.method, c.path, c.host])).toEqual(
        expected.map(([verb, path, host]) => [verb, path, host ?? HUB]),
      )
    })
  }
})

/** Run a command and return the body of its LAST request (the write). */
async function bodyOf(argv: string[]): Promise<Record<string, unknown> | undefined> {
  const {error} = await runCommand([...argv, ...globalArgs])
  expect(error).toBeUndefined()
  return sent(argv).at(-1)?.body
}

describe('general info', () => {
  it('health sends --refresh and --period as query values, no body', async () => {
    await bodyOf(['project', 'health', '--refresh', '--period', '7', '--prod'])
    const [call] = sent(['project'])
    expect(Object.fromEntries(call!.query)).toEqual({refresh: 'true', periodDays: '7'})
    expect(call!.body).toBeUndefined()
  })

  it('health sends --severity, --module, --page and --page-size as query values', async () => {
    await bodyOf(['project', 'health', '--severity', 'Error', '--module', 'Email', '--page', '1', '--page-size', '20', '--prod'])
    const [call] = sent(['project'])
    expect(call).toMatchObject({method: 'GET'})
    expect(Object.fromEntries(call!.query)).toEqual({severity: 'Error', module: 'Email', pageNumber: '1', pageSize: '20'})
    expect(call!.body).toBeUndefined()
  })

  it('health refuses a page size over 100 and sends nothing', async () => {
    const {error} = await runCommand(['project', 'health', '--page-size', '101', '--prod', ...globalArgs])
    expect(error?.message).toMatch(/100/)
    expect(sent(['project'])).toHaveLength(0)
  })

  it('wait-active sends --timeout as timeoutSeconds', async () => {
    await bodyOf(['project', 'wait-active', '--timeout', '60', '--prod'])
    expect(Object.fromEntries(sent(['project'])[0]!.query)).toEqual({timeoutSeconds: '60'})
  })

  it('create sends the project and its connection-string database', async () => {
    expect(await bodyOf([
      'project', 'create', '--name', 'Shop', '--primary', 'nb-eu-germany', '--additional', 'nb-us-east',
      '--description', 'Orders', '--connection-string', CS, '--database', 'shop',
    ])).toEqual({
      projectName: 'Shop',
      primaryRegion: 'nb-eu-germany',
      additionalRegions: ['nb-us-east'],
      description: 'Orders',
      integration: {
        provider: 'MongoDbConnectionString',
        integrationName: 'Shop database',
        isEnabled: true,
        connectionString: CS,
        databaseName: 'shop',
      },
    })
  })

  it('create needs a connection string and sends nothing without one', async () => {
    const {error} = await runCommand(['project', 'create', '--name', 'Shop', ...globalArgs])
    expect(error?.message).toMatch(/--connection-string/)
    expect(calls).toHaveLength(0)
  })

  it('create --dry-run sends nothing and masks the connection string', async () => {
    const {stdout, error} = await runCommand(['project', 'create', '--name', 'Shop', '--connection-string', CS, '--dry-run', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
    const shown = `${stdout}\n${printed.join('\n')}`
    expect(shown).toContain('"connectionString":"***"')
    expect(shown).not.toContain('secret')
    // The primary region is never guessed: without --primary it is not sent.
    expect(shown).not.toContain('primaryRegion')
  })
})

describe('languages', () => {
  it('check-languages sends the proposed list and default', async () => {
    expect(await bodyOf(['project', 'check-languages', 'en', 'lt,de', '--default', 'lt', '--prod'])).toEqual({
      languages: ['en', 'lt', 'de'],
      defaultLanguage: 'lt',
    })
  })

  it('check-languages with nothing checks the current settings (no body fields)', async () => {
    const body = await bodyOf(['project', 'check-languages', '--prod'])
    expect(body ?? {}).toEqual({})
    expect(sent(['project']).map((c) => [c.method, c.path])).toEqual([['POST', `${S}/languages/check`]])
  })
})

describe('environments', () => {
  it('create sends the upper-case name and the database integration', async () => {
    expect(await bodyOf(['env', 'create', 'staging', '--connection-string', CS, '--database', 'shop_staging'])).toEqual({
      environmentName: 'STAGING',
      integration: {
        provider: 'MongoDbConnectionString',
        integrationName: 'STAGING database',
        isEnabled: true,
        connectionString: CS,
        databaseName: 'shop_staging',
      },
    })
  })

  it('create refuses PROD and sends nothing', async () => {
    const {error} = await runCommand(['env', 'create', 'prod', '--connection-string', CS, ...globalArgs])
    expect(error?.message).toMatch(/PROD exists/)
    expect(calls).toHaveLength(0)
  })

  it('create --dry-run sends nothing', async () => {
    const {stdout, error} = await runCommand(['env', 'create', 'TEST2', '--connection-string', CS, '--dry-run', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
    expect(`${stdout}\n${printed.join('\n')}`).not.toContain('secret')
  })

  it('rank sends the rank; a rank that is not a whole number sends nothing', async () => {
    expect(await bodyOf(['env', 'rank', 'staging', '2'])).toEqual({rank: 2})
    calls = []
    const {error} = await runCommand(['env', 'rank', 'STAGING', 'top', ...globalArgs])
    expect(error?.message).toMatch(/whole number/)
    expect(calls).toHaveLength(0)
  })

  it('delete asks first without --yes and sends nothing', async () => {
    const {error} = await runCommand(['env', 'delete', 'STAGING', ...globalArgs])
    expect((error as {code?: string} | undefined)?.code).toBe('CONFIRMATION_REQUIRED')
    expect(calls).toHaveLength(0)
  })
})

describe('legal and brand', () => {
  it('brand show --output saves the bytes the API host answered', async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'norbix-brand-')), 'logo.png')
    const {error} = await runCommand(['project', 'brand', 'show', 'logo', '--output', out, '--prod', ...globalArgs])
    expect(error).toBeUndefined()
    expect(existsSync(out)).toBe(true)
    expect(readFileSync(out, 'utf8')).toBe('{}')
    expect(sent(['project'])[0]?.host).toBe(API)
  })
})

describe('ai settings', () => {
  it('knowledge set sends embedFiles; nothing without a value', async () => {
    expect(await bodyOf(['project', 'ai', 'knowledge', 'set', '--embed-files', 'false', '--prod'])).toEqual({embedFiles: false})
    calls = []
    const {error} = await runCommand(['project', 'ai', 'knowledge', 'set', '--prod', ...globalArgs])
    expect(error?.message).toMatch(/--embed-files/)
    expect(sent(['project'])).toHaveLength(0)
  })

  it('plans set --plan keeps the stored plans, changes only the passed fields of a stored one and adds a new one', async () => {
    expect(await bodyOf([
      'project', 'ai', 'plans', 'set', '--prod',
      '--plan', '{"id":"aip_pro","monthlyQuota":9000}',
      '--plan', '{"name":"Team","quotaUnit":"None"}',
    ])).toEqual({
      plans: [
        {id: 'aip_free', name: 'Free', quotaUnit: 'Credits', monthlyQuota: 100},
        {
          id: 'aip_pro', name: 'Pro', quotaUnit: 'Credits', monthlyQuota: 9000,
          allowedModels: [{llmIntegrationId: 'int_llm', model: 'gpt-4o'}], features: {attachments: true, memory: false},
        },
        {name: 'Team', quotaUnit: 'None'},
      ],
    })
  })

  it('plans set --plan with an id that is not stored saves nothing', async () => {
    const {error} = await runCommand(['project', 'ai', 'plans', 'set', '--plan', '{"id":"aip_gone","name":"X"}', '--prod', ...globalArgs])
    expect(error?.message).toMatch(/No AI plan aip_gone/)
    expect(sent(['project']).map((c) => c.method)).toEqual(['GET'])
  })

  it('plans set --remove asks first and sends no write without --yes', async () => {
    const {error} = await runCommand(['project', 'ai', 'plans', 'set', '--remove', 'aip_pro', '--prod', ...globalArgs])
    expect((error as {code?: string} | undefined)?.code).toBe('CONFIRMATION_REQUIRED')
    expect(sent(['project']).map((c) => c.method)).toEqual(['GET'])
  })

  it('plans set --remove --yes keeps the other plans', async () => {
    expect(await bodyOf(['project', 'ai', 'plans', 'set', '--remove', 'aip_pro', '--yes', '--prod'])).toEqual({
      plans: [{id: 'aip_free', name: 'Free', quotaUnit: 'Credits', monthlyQuota: 100}],
    })
  })

  it('plans set --remove of an unknown plan saves nothing', async () => {
    const {error} = await runCommand(['project', 'ai', 'plans', 'set', '--remove', 'aip_nope', '--yes', '--prod', ...globalArgs])
    expect(error?.message).toMatch(/No AI plan aip_nope/)
    expect(sent(['project']).map((c) => c.method)).toEqual(['GET'])
  })

  it('plans set stops when the plans cannot be read', async () => {
    plansAnswer = {}
    const {error} = await runCommand(['project', 'ai', 'plans', 'set', '--plan', '{"name":"Team"}', '--prod', ...globalArgs])
    expect(error?.message).toMatch(/Could not read the current AI plans/)
    expect(sent(['project']).map((c) => c.method)).toEqual(['GET'])
  })

  it('plans set --file replaces the list without reading, and asks first', async () => {
    const {error} = await runCommand(['project', 'ai', 'plans', 'set', '--file', '[{"name":"Only"}]', '--prod', ...globalArgs])
    expect((error as {code?: string} | undefined)?.code).toBe('CONFIRMATION_REQUIRED')
    expect(sent(['project'])).toHaveLength(0)
    expect(await bodyOf(['project', 'ai', 'plans', 'set', '--file', '{"plans":[{"name":"Only"}]}', '--yes', '--prod'])).toEqual({
      plans: [{name: 'Only'}],
    })
    expect(sent(['project']).map((c) => c.method)).toEqual(['PUT'])
  })

  it('plans set --dry-run sends nothing, not even the read', async () => {
    const {error} = await runCommand(['project', 'ai', 'plans', 'set', '--plan', '{"name":"Team"}', '--dry-run', '--prod', ...globalArgs])
    expect(error).toBeUndefined()
    expect(sent(['project'])).toHaveLength(0)
  })

  it('plans assign --default keeps the stored role rows', async () => {
    expect(await bodyOf(['project', 'ai', 'plans', 'assign', '--default', 'aip_pro', '--prod'])).toEqual({
      roles: [{roleId: 'rl_pro', planId: 'aip_pro'}],
      defaultPlanId: 'aip_pro',
    })
  })

  it('plans assign --role keeps the stored default and keeps the row order', async () => {
    expect(await bodyOf(['project', 'ai', 'plans', 'assign', '--role', 'rl_b=aip_free', '--role', 'rl_a=aip_pro', '--prod'])).toEqual({
      roles: [{roleId: 'rl_b', planId: 'aip_free'}, {roleId: 'rl_a', planId: 'aip_pro'}],
      defaultPlanId: 'aip_free',
    })
  })

  it('plans assign with both parts does not read first', async () => {
    expect(await bodyOf(['project', 'ai', 'plans', 'assign', '--clear-roles', '--clear-default', '--prod'])).toEqual({
      roles: [],
      defaultPlanId: '',
    })
    expect(sent(['project']).map((c) => c.method)).toEqual(['PUT'])
  })

  it('plans assign refuses a role without a plan and sends nothing', async () => {
    const {error} = await runCommand(['project', 'ai', 'plans', 'assign', '--role', 'rl_a', '--prod', ...globalArgs])
    expect(error?.message).toMatch(/roleId=planId/)
    expect(sent(['project'])).toHaveLength(0)
  })
})

describe('billing', () => {
  it('discount check sends the code, and the bundle and period when given', async () => {
    expect(await bodyOf(['account', 'discount', 'check', 'LAUNCH30', '--bundle', 'growth', '--period', 'annual', '--prod'])).toEqual({
      code: 'LAUNCH30',
      bundle: 'Growth',
      billingPeriod: 'Annual',
    })
    calls = []
    expect(await bodyOf(['account', 'discount', 'check', 'LAUNCH30', '--prod'])).toEqual({code: 'LAUNCH30'})
  })
})
