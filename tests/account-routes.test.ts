import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {cli, makeHome, parseSingleJson, startFakeGateway} from './_cli.js'
import {envListAnswer} from './_env.js'

/**
 * `account team`, `account me`, `account me set-phone`, the bundles and the
 * clusters commands through oclif and the real `@norbix.ai/ts` transport: verb, path, query string and body of the one
 * request each sends. `fetch` is replaced, so nothing leaves the process.
 * `account.test.ts` checks the SDK method and fields with a recorder.
 */

interface Call {
  method: string
  path: string
  query: URLSearchParams
  headers: Headers
  body?: Record<string, unknown>
}

let calls: Call[]
let answer: unknown
let status: number
let realFetch: typeof globalThis.fetch

beforeEach(() => {
  calls = []
  answer = {}
  status = 200
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const envList = envListAnswer(input, init)
    if (envList) return envList
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push({
      method: init?.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
    })
    return new Response(JSON.stringify(answer), {status, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']
const PHONE = '+37060000000'
const CLUSTER = 'fxc_2ToIiRM03X63TZaJ2dJdv2'

/** [argv, verb, path] — argv without the leading `account`. */
const routes: Array<[string[], string, string]> = [
  [['team'], 'GET', '/v3/account/collaborators'],
  [['me'], 'GET', '/v3/account/me'],
  [['me', 'set-phone', PHONE], 'PUT', '/v3/account/me/phone'],
  [['me', 'set-phone', '--clear'], 'PUT', '/v3/account/me/phone'],
  [['regions'], 'GET', '/v3/account/regions'],
  [['bundles'], 'GET', '/v3/account/stripe/bundles'],
  [['change-bundle', '--bundle', 'growth', '--period', 'annual', '--yes'], 'POST', '/v3/account/stripe/change-bundle'],
  [['clusters'], 'GET', '/v3/account/flex-clusters'],
  [['clusters', 'upgrade', CLUSTER, '--yes'], 'POST', `/v3/account/flex-clusters/${CLUSTER}/upgrade`],
]

describe('every account command of this round reaches its route', () => {
  for (const [argv, verb, path] of routes) {
    it(`account ${argv.join(' ')} → ${verb} ${path}`, async () => {
      const {error} = await runCommand(['account', ...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe(verb)
      expect(calls[0]?.path).toBe(path)
    })
  }
})

describe('account team — flat paging and filters on the query string', () => {
  it('sends pageSize, startingAfter, endingBefore, projectId and includeAccountOwner as flat query fields', async () => {
    const {error} = await runCommand([
      'account', 'team', '--page-size', '50', '--after', 'acc_usr_20', '--before', 'acc_usr_90',
      '--in-project', 'prj_1', '--include-owner', ...globalArgs,
    ])
    expect(error).toBeUndefined()
    const q = calls[0]!.query
    expect(q.get('pageSize')).toBe('50')
    expect(q.get('startingAfter')).toBe('acc_usr_20')
    expect(q.get('endingBefore')).toBe('acc_usr_90')
    expect(q.get('projectId')).toBe('prj_1')
    expect(q.get('includeAccountOwner')).toBe('true')
    // The nested object is no longer bound by the gateway (14-sms S125).
    expect([...q.keys()].some((k) => k.toLowerCase().startsWith('pagingargs'))).toBe(false)
  })

  it('without flags sends no filter, and the global --project does not narrow the list', async () => {
    await runCommand(['account', 'team', ...globalArgs])
    for (const key of ['pageSize', 'startingAfter', 'endingBefore', 'projectId', 'includeAccountOwner']) {
      expect(calls[0]?.query.has(key)).toBe(false)
    }
  })
})

describe('account me set-phone — the JSON body', () => {
  it('sends the phone', async () => {
    await runCommand(['account', 'me', 'set-phone', PHONE, ...globalArgs])
    expect(calls[0]?.body).toEqual({phone: PHONE})
  })

  it('--clear sends an empty phone, which clears it', async () => {
    await runCommand(['account', 'me', 'set-phone', '--clear', ...globalArgs])
    expect(calls[0]?.body).toEqual({phone: ''})
  })

  it('needs a phone or --clear, and not both — refused before any request', async () => {
    const none = await runCommand(['account', 'me', 'set-phone', ...globalArgs])
    expect(none.error?.message).toMatch(/Pass a phone number/)
    const both = await runCommand(['account', 'me', 'set-phone', PHONE, '--clear', ...globalArgs])
    expect(both.error?.message).toMatch(/not both/)
    expect(calls).toHaveLength(0)
  })

  it('--dry-run sends nothing', async () => {
    const {error} = await runCommand(['account', 'me', 'set-phone', PHONE, '--dry-run', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
  })
})

/**
 * `account regions` is anonymous on the gateway (no [Authenticate] on
 * GET /{version}/account/regions) and `@norbix.ai/ts` 4.9.1 sends it with no
 * Authorization header. The test HOME is empty (see test/setup.ts), so there
 * is no login session and no profile.
 */
describe('account regions — no login, no project', () => {
  it('runs without a login or a project and sends no Authorization header', async () => {
    const {error} = await runCommand(['account', 'regions', '--region', 'nb-eu-germany'])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe('/v3/account/regions')
    expect(calls[0]?.headers.get('Authorization')).toBeNull()
    expect(calls[0]?.headers.get('norbix-project-id')).toBeNull()
  })
})

/**
 * `account projects`, `account status`, the bundles and the clusters commands
 * are about the account, not one project: a service-user key with no project configured must reach them,
 * and no project header goes out.
 */
describe('account projects / status / bundles / clusters — no project needed', () => {
  for (const [argv, path] of [
    [['projects'], '/v3/account/projects'],
    [['status'], '/v3/account/status'],
    [['bundles'], '/v3/account/stripe/bundles'],
    [['clusters'], '/v3/account/flex-clusters'],
    [['change-bundle', '--bundle', 'scale', '--period', 'monthly', '--yes'], '/v3/account/stripe/change-bundle'],
    [['clusters', 'upgrade', CLUSTER, '--yes'], `/v3/account/flex-clusters/${CLUSTER}/upgrade`],
  ] as const) {
    it(`account ${argv.join(' ')} runs with only an API key and sends no project header`, async () => {
      const {error} = await runCommand(['account', ...argv, '--api-key', 'nbsu_k', '--region', 'nb-eu-germany'])

      expect(error).toBeUndefined()
      expect(calls).toHaveLength(1)
      expect(calls[0]?.path).toBe(path)
      expect(calls[0]?.headers.get('norbix-project-id')).toBeNull()
      expect(calls[0]?.headers.get('Authorization')).toBe('Bearer nbsu_k')
    })
  }
})

describe('account usage — workflow months are counts', () => {
  let printed: string[]
  const out = () => printed.join('\n')

  beforeEach(() => {
    printed = []
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
      printed.push(parts.join(' '))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const usage = {
    item: {
      accountId: 'acc_1',
      atlas: {},
      ingestionFailures: [],
      workflows: {
        '2026-10': {period: '2026-10', runs: 12, stepRuns: 340, perProject: [{projectId: 'pr_1', env: 'PROD', runs: 12, stepRuns: 340}]},
        '2026-11': {period: '2026-11', runs: 3, stepRuns: 9, perProject: []},
      },
    },
  }

  it('prints the answer, then the months newest first and the line that they are not billed', async () => {
    answer = usage
    const {error} = await runCommand(['account', 'usage', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.path).toBe('/v3/account/usage-billing')
    expect(out()).toContain('"accountId": "acc_1"')
    expect(out().slice(out().indexOf('Workflows\n')).trim().split('\n')).toEqual([
      'Workflows',
      'PERIOD   RUNS  STEP RUNS',
      '2026-11  3     9',
      '2026-10  12    340',
      '',
      'Workflow runs and step runs are counted, not billed.',
    ])
  })

  it('--json answers the raw document and no table', async () => {
    answer = usage
    const {result} = await runCommand(['account', 'usage', '--json', ...globalArgs])

    expect(result).toEqual(usage)
    expect(out()).not.toContain('STEP RUNS')
    expect(out()).not.toContain('not billed')
  })

  it('no workflow month prints no table and no line', async () => {
    answer = {item: {accountId: 'acc_1', atlas: {}, ingestionFailures: [], workflows: {}}}
    await runCommand(['account', 'usage', ...globalArgs])

    expect(out()).toContain('"accountId": "acc_1"')
    expect(out()).not.toContain('STEP RUNS')
    expect(out()).not.toContain('not billed')
  })
})

/** The printed lines of a command (`console.log` is where oclif's `this.log` ends). */
function captureOutput() {
  const printed: string[] = []
  beforeEach(() => {
    printed.length = 0
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
      printed.push(parts.join(' '))
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })
  return () => printed.join('\n')
}

describe('account bundles — the three bundles as a table', () => {
  const out = captureOutput()
  const bundles = {
    bundles: [
      {bundle: 'Starter', projectCap: 3, monthly: {amount: 5900, currency: 'usd'}, annual: {amount: 59000, currency: 'usd'}},
      {bundle: 'Growth', projectCap: 10, monthly: {amount: 14900, currency: 'usd'}, annual: {amount: 149000, currency: 'usd'}},
      {bundle: 'Scale', projectCap: 30, monthly: {amount: 39950, currency: 'eur'}, annual: {amount: 399500, currency: 'eur'}},
    ],
  }

  it('prints name, project limit and both prices: minor units as money, the currency in upper case', async () => {
    answer = bundles
    const {error} = await runCommand(['account', 'bundles', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.query.size).toBe(0)
    expect(out().split('\n')).toEqual([
      'BUNDLE   PROJECTS  MONTHLY     ANNUAL',
      'Starter  3         59.00 USD   590.00 USD',
      'Growth   10        149.00 USD  1490.00 USD',
      'Scale    30        399.50 EUR  3995.00 EUR',
    ])
  })

  it('--json answers the raw document (minor units, lower-case currency) and no table', async () => {
    answer = bundles
    const {result} = await runCommand(['account', 'bundles', '--json', ...globalArgs])

    expect(result).toEqual(bundles)
    expect(out()).not.toContain('BUNDLE')
  })
})

describe('account change-bundle — the body, the question, the refusal', () => {
  it('sends the bundle and the billing period as the gateway spells them', async () => {
    const {error} = await runCommand(['account', 'change-bundle', '--bundle', 'growth', '--period', 'annual', '--yes', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.body).toEqual({bundle: 'Growth', billingPeriod: 'Annual'})
  })

  it('without --yes in a shell with no terminal it asks, sends nothing and says what would change', async () => {
    const {error} = await runCommand(['account', 'change-bundle', '--bundle', 'starter', '--period', 'monthly', ...globalArgs])

    expect(error?.message).toBe('Confirmation required: Move the account to the Starter bundle, billed monthly? This changes what the account pays.')
    expect((error as {code?: string} | undefined)?.code).toBe('CONFIRMATION_REQUIRED')
    expect(calls).toHaveLength(0)
  })

  it('--dry-run sends nothing and needs no --yes', async () => {
    const {error} = await runCommand(['account', 'change-bundle', '--bundle', 'starter', '--period', 'monthly', '--dry-run', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
  })

  it('needs both flags and only takes the three bundles and the two periods — refused before any request', async () => {
    const noPeriod = await runCommand(['account', 'change-bundle', '--bundle', 'growth', '--yes', ...globalArgs])
    expect(noPeriod.error?.message).toMatch(/Missing required flag period/)
    const noBundle = await runCommand(['account', 'change-bundle', '--period', 'annual', '--yes', ...globalArgs])
    expect(noBundle.error?.message).toMatch(/Missing required flag bundle/)
    const badBundle = await runCommand(['account', 'change-bundle', '--bundle', 'huge', '--period', 'annual', '--yes', ...globalArgs])
    expect(badBundle.error?.message).toMatch(/Expected --bundle=huge to be one of: starter, growth, scale/)
    const badPeriod = await runCommand(['account', 'change-bundle', '--bundle', 'growth', '--period', 'weekly', '--yes', ...globalArgs])
    expect(badPeriod.error?.message).toMatch(/Expected --period=weekly to be one of: monthly, annual/)
    expect(calls).toHaveLength(0)
  })

  /** The gateway's BundleAllowsFewerProjectsThanEnabledError: HTTP 400, the numbers in the context. */
  const MESSAGE = 'Starter allows 3 enabled projects and you have 5. Disable 2 projects first, then change the bundle.'
  const refusal = {
    responseStatus: {
      errorCode: 'CM-ERRORS-ACCOUNT-023',
      message: MESSAGE,
      errors: [
        {
          errorCode: 'CM-ERRORS-ACCOUNT-023',
          message: MESSAGE,
          context: {ErrorCode: 'CM-ERRORS-ACCOUNT-023', enabledProjects: 5, projectCap: 3, bundle: 'Starter'},
        },
      ],
    },
  }

  it('CM-ERRORS-ACCOUNT-023: the error is the server message with the numbers and how to turn projects off, exit 6', async () => {
    answer = refusal
    status = 400
    const {error, stderr} = await runCommand(['account', 'change-bundle', '--bundle', 'starter', '--period', 'monthly', '--yes', ...globalArgs])

    expect(calls).toHaveLength(1)
    expect(error?.message).toBe(MESSAGE)
    const refused = error as {code?: string; status?: number; hint?: string; context?: Record<string, unknown>; oclif?: {exit?: number}} | undefined
    expect(refused?.code).toBe('CM-ERRORS-ACCOUNT-023')
    expect(refused?.status).toBe(400)
    expect(refused?.oclif?.exit).toBe(6)
    expect(refused?.context).toMatchObject({enabledProjects: 5, projectCap: 3, bundle: 'Starter'})
    expect(refused?.hint).toContain('norbix project disable --project <id> --yes')
    expect(stderr).not.toContain('fieldErrors names the fields')
  })

  it('any other refusal is reported as the gateway sent it', async () => {
    answer = {responseStatus: {errorCode: 'CM-ERRORS-ACCOUNT-SUBSCRIPTION-005', message: 'The account has no subscription.'}}
    status = 400
    const {error} = await runCommand(['account', 'change-bundle', '--bundle', 'starter', '--period', 'monthly', '--yes', ...globalArgs])

    expect(error?.message).toBe('The account has no subscription.')
    expect((error as {code?: string} | undefined)?.code).toBe('CM-ERRORS-ACCOUNT-SUBSCRIPTION-005')
  })
})

/**
 * The same refusal as a script or an agent sees it: the built CLI as a child
 * process against a fake gateway on a local port. Text on stderr, or one JSON
 * document on stdout with --json; exit 6 in both.
 */
describe('account change-bundle — CM-ERRORS-ACCOUNT-023 from the outside', () => {
  const MESSAGE = 'Starter allows 3 enabled projects and you have 5. Disable 2 projects first, then change the bundle.'
  const PATH = '/v3/account/stripe/change-bundle'
  const refusal = {
    __status: 400,
    responseStatus: {
      errorCode: 'CM-ERRORS-ACCOUNT-023',
      message: MESSAGE,
      errors: [{errorCode: 'CM-ERRORS-ACCOUNT-023', message: MESSAGE, context: {enabledProjects: 5, projectCap: 3, bundle: 'Starter'}}],
    },
  }
  const argv = ['account', 'change-bundle', '--bundle', 'starter', '--period', 'monthly', '--yes', '--profile', 'x']

  it('prints the server message and the hint on stderr, nothing on stdout, exit 6', async () => {
    const gateway = await startFakeGateway({[PATH]: refusal})
    try {
      const r = await cli(makeHome(gateway.port), argv)

      expect(r.code).toBe(6)
      expect(r.stdout).toBe('')
      expect(r.stderr).toContain(MESSAGE)
      expect(r.stderr).toContain('norbix project disable --project <id> --yes')
      expect(r.stderr).not.toContain('fieldErrors names the fields')
      expect(gateway.hits.map((h) => `${h.method} ${h.url}`)).toEqual([`POST ${PATH}`])
      expect(JSON.parse(gateway.hits[0]!.body)).toEqual({bundle: 'Starter', billingPeriod: 'Monthly'})
    } finally {
      await gateway.close()
    }
  })

  it('--json: one error document with the code, the message and the numbers, exit 6', async () => {
    const gateway = await startFakeGateway({[PATH]: refusal})
    try {
      const r = await cli(makeHome(gateway.port), [...argv, '--json'])

      expect(r.code).toBe(6)
      const doc = parseSingleJson(r.stdout) as {error: {code: string; message: string; status: number; exit: number; context: Record<string, unknown>; hint: string}}
      expect(doc.error.code).toBe('CM-ERRORS-ACCOUNT-023')
      expect(doc.error.message).toBe(MESSAGE)
      expect(doc.error.status).toBe(400)
      expect(doc.error.exit).toBe(6)
      expect(doc.error.context).toMatchObject({enabledProjects: 5, projectCap: 3, bundle: 'Starter'})
      expect(doc.error.hint).toContain('norbix project disable')
    } finally {
      await gateway.close()
    }
  })

  it('without --yes: exit 3, nothing sent', async () => {
    const gateway = await startFakeGateway({[PATH]: refusal})
    try {
      const r = await cli(makeHome(gateway.port), argv.filter((a) => a !== '--yes'))

      expect(r.code).toBe(3)
      expect(r.stderr).toContain('Confirmation required: Move the account to the Starter bundle, billed monthly?')
      expect(gateway.hits).toEqual([])
    } finally {
      await gateway.close()
    }
  })
})

describe('account clusters — the list', () => {
  const out = captureOutput()
  const clusters = {
    clusters: [
      {
        id: 'fxc_1',
        displayName: 'Shared',
        atlasClusterName: 'nbx-a1',
        norbixRegionCode: 'nb-eu-germany',
        tierCode: 'FLEX',
        status: 'Active',
        databases: [
          {projectId: 'pr_1', projectName: 'Shop', env: 'PROD', integrationId: 'int_1', integrationName: 'Main', databaseName: 'shop_prod'},
          {projectId: 'pr_1', projectName: 'Shop', env: 'TEST', integrationId: 'int_2', integrationName: 'Main'},
        ],
        usage: {databaseCount: 2, storageBytes: 4_800_000_000, connections: 120, operationsPerSecond: 12.5},
        nearLimits: ['Storage', 'Connections'],
      },
      {
        id: 'fxc_2',
        displayName: 'Blog',
        atlasClusterName: 'nbx-b2',
        norbixRegionCode: 'nb-us-east',
        tierCode: 'M10',
        status: 'Provisioning',
        databases: [],
        usage: {databaseCount: 0},
        nearLimits: [],
      },
    ],
    canCreateNew: true,
  }

  it('prints id, name, region, tier, status, the database count and the near-limit marks', async () => {
    answer = clusters
    const {error} = await runCommand(['account', 'clusters', ...globalArgs])

    expect(error).toBeUndefined()
    expect(out().split('\n')).toEqual([
      'ID     NAME    REGION         TIER  STATUS        DATABASES  NEAR LIMIT',
      'fxc_1  Shared  nb-eu-germany  FLEX  Active        2          Storage, Connections',
      'fxc_2  Blog    nb-us-east     M10   Provisioning  0          -',
    ])
  })

  it('--json answers the whole document, databases and usage included, and no table', async () => {
    answer = clusters
    const {result} = await runCommand(['account', 'clusters', '--json', ...globalArgs])

    expect(result).toEqual(clusters)
    expect(out()).not.toContain('NEAR LIMIT')
  })

  it('says why a new cluster cannot be created', async () => {
    answer = {clusters: [clusters.clusters[0]], canCreateNew: false, cannotCreateReason: 'TrialOneCluster'}
    await runCommand(['account', 'clusters', ...globalArgs])
    expect(out().split('\n').slice(-2)).toEqual(['', 'A new cluster cannot be created: a trial account has one cluster.'])

    answer = {clusters: [clusters.clusters[0]], canCreateNew: false, cannotCreateReason: 'ClusterLimitReached'}
    await runCommand(['account', 'clusters', ...globalArgs])
    expect(out().split('\n').at(-1)).toBe('A new cluster cannot be created: the account has reached its cluster limit.')
  })

  it('no cluster prints one line', async () => {
    answer = {clusters: [], canCreateNew: true}
    await runCommand(['account', 'clusters', ...globalArgs])
    expect(out()).toBe('No Norbix-managed clusters.')
  })
})

describe('account clusters upgrade — the path, the body, the question', () => {
  const out = captureOutput()

  it('puts the cluster id in the path, sends tierCode M10 and says the upgrade is queued', async () => {
    const {error} = await runCommand(['account', 'clusters', 'upgrade', CLUSTER, '--yes', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.path).toBe(`/v3/account/flex-clusters/${CLUSTER}/upgrade`)
    expect(calls[0]?.body).toEqual({tierCode: 'M10'})
    expect(out()).toBe(`Upgrade of cluster ${CLUSTER} to M10 is queued. \`norbix account clusters\` shows M10 some minutes later.`)
  })

  it('without --yes in a shell with no terminal it asks, sends nothing and names what changes', async () => {
    const {error} = await runCommand(['account', 'clusters', 'upgrade', CLUSTER, ...globalArgs])

    expect(error?.message).toBe(
      `Confirmation required: Move cluster ${CLUSTER} to M10? Every database on it moves, and the price of the cluster changes.`,
    )
    expect(calls).toHaveLength(0)
  })

  it('--dry-run sends nothing; no id is refused before any request', async () => {
    const dry = await runCommand(['account', 'clusters', 'upgrade', CLUSTER, '--dry-run', ...globalArgs])
    expect(dry.error).toBeUndefined()
    const none = await runCommand(['account', 'clusters', 'upgrade', '--yes', ...globalArgs])
    expect(none.error?.message).toMatch(/Missing 1 required arg/)
    expect(calls).toHaveLength(0)
  })
})
