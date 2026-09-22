import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

/**
 * One row per push endpoint: run the command the way a user types it, through
 * oclif and the real `@norbix.ai/ts` transport, and check the verb and path of
 * the request it sends.
 *
 * `push.test.ts` swaps the SDK for a recorder, which cannot see route tokens.
 * The transport fills `{Id}` / `{id}` by exact name and throws
 * NORBIX_MISSING_PATH_PARAM when the name is wrong — `push stop` shipped that
 * way with a green recorder test. Here the request goes all the way to `fetch`,
 * which is replaced, so nothing leaves the process and no push provider is
 * contacted.
 */

const ID = '66b2f0a1'
const BATCH = 'b7c3'
const MESSAGE = 'n9d4'

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
    return new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

const P = '/v2/notifications/push'

/** [argv, verb, path] — argv without the leading `push`. */
const routes: Array<[string[], string, string]> = [
  // Module
  [['settings'], 'GET', `${P}/settings`],
  [['enable'], 'GET', `${P}/enable`],
  [['disable', '--yes'], 'GET', `${P}/disable`],
  [['disable-dependencies'], 'GET', `${P}/disable-dependencies`],

  // Integrations
  [['integrations'], 'GET', `${P}/integrations`],
  [['integration', ID], 'GET', `${P}/integrations/${ID}`],
  [['integration', 'enable', ID], 'PUT', `${P}/integrations/${ID}/enable`],
  [['integration', 'disable', ID], 'PUT', `${P}/integrations/${ID}/disable`],
  [['integration', 'default', ID], 'PUT', `${P}/integrations/${ID}/default`],
  [['integration', 'delete', ID, '--yes'], 'DELETE', `${P}/integrations/${ID}`],
  [['integration', 'test', '--integration', ID, '--token', 'dGVzdA==', '--family', 'Ios'], 'POST', `${P}/integrations/test`],
  [['integration', 'save', '--provider', 'Fake'], 'POST', `${P}/integrations`],
  [['integration', 'confirm-delivery', ID], 'POST', `${P}/integrations/confirm-human-delivery`],
  [
    ['integration', 'app-request', '--user', 'usr_1', '--request-id', 'req_1', '--pin', '123456', '--valid-till', '2026-09-20T12:00:00Z', '--public-key', 'pk', '--account', 'acc_1'],
    'POST',
    `${P}/integrations/app/request`,
  ],

  // Devices
  [['device', 'register', '--user', 'usr_1', '--token', 'dGVzdA==', '--os', 'iOS'], 'POST', `${P}/devices`],
  [['devices'], 'GET', `${P}/devices`],
  [['devices', '--platform', 'ios', '--user', 'usr_1', '--token', 'dGVzdA=='], 'GET', `${P}/devices`],
  [['device', ID], 'GET', `${P}/devices/${ID}`],

  // Templates
  [['templates'], 'GET', `${P}/templates`],
  [['template', ID], 'GET', `${P}/templates/${ID}`],
  [['archive', ID], 'PUT', `${P}/templates/${ID}/archive`],
  [['unarchive', ID], 'PUT', `${P}/templates/${ID}/unarchive`],
  [['clone', ID], 'POST', `${P}/templates/${ID}/clone`],
  [['delete', ID, '--yes'], 'DELETE', `${P}/templates/${ID}`],
  [['template', 'create', '--name', 'Welcome', '--title', 'Hi', '--body', 'Thanks'], 'POST', `${P}/templates`],
  [['template', 'update', ID, '--name', 'Welcome', '--title', 'Hi', '--body', 'Thanks'], 'PUT', `${P}/templates`],
  [['template', 'render', '--code', '@Model.Name', '--token', 'Name=Ada'], 'POST', `${P}/templates/render`],
  [['template', 'tokens', ID], 'GET', `${P}/templates/${ID}/tokens`],

  // Campaigns
  [['campaigns'], 'GET', `${P}/campaigns`],
  [['campaign', ID], 'GET', `${P}/campaigns/${ID}`],
  [['campaign', ID, '--stats'], 'GET', `${P}/campaigns/${ID}/stats`],
  [['preview', '8f2a91c4'], 'GET', `${P}/preview`],
  [['stop', ID, '--yes'], 'POST', `${P}/campaigns/${ID}/stop`],
  [['campaign', 'create', '--template', ID, '--audience', 'all-users'], 'POST', `${P}/campaigns`],
  [['campaign', 'delete', ID, '--yes'], 'DELETE', `${P}/campaigns/${ID}`],
  [['campaign', 'batches', ID], 'GET', `${P}/campaigns/${ID}/batches`],
  [['campaign', 'batch', ID, BATCH], 'GET', `${P}/campaigns/${ID}/batches/${BATCH}`],
  [['campaign', 'batch', ID, BATCH, MESSAGE], 'GET', `${P}/campaigns/${ID}/batches/${BATCH}/${MESSAGE}`],
  [['campaign', 'messages', ID, '--batch', BATCH], 'GET', `${P}/campaigns/${ID}/messages`],
  [['campaign', 'message', ID, MESSAGE, '--batch', BATCH], 'GET', `${P}/campaigns/${ID}/messages/${MESSAGE}`],
]

describe('every push command reaches its route', () => {
  for (const [argv, verb, path] of routes) {
    it(`push ${argv.join(' ')} → ${verb} ${path}`, async () => {
      const {error} = await runCommand(['push', ...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe(verb)
      expect(calls[0]?.path).toBe(path)
    })
  }
})


it('covers all 39 push routes', () => {
  // One row per route the SDK exposes (lane D counted 37; the devices read
  // side added the list and the get). The campaign `--stats` row, the batch
  // row and the second `devices` row share a route with another row, so count
  // distinct verb + path pairs.
  expect(new Set(routes.map(([, verb, path]) => `${verb} ${path}`)).size).toBe(39)
})

/** Run a command and return the one request body it sent. */
// Note: @oclif/test's runCommand splits argv on spaces, so no test value here
// contains one.
async function bodyOf(argv: string[]): Promise<Record<string, unknown>> {
  const {error} = await runCommand(['push', ...argv, ...globalArgs])
  expect(error).toBeUndefined()
  expect(calls).toHaveLength(1)
  return calls[0]?.body ?? {}
}

describe('push integration save', () => {
  it('saves the Fake provider with nothing else needed', async () => {
    const body = await bodyOf(['integration', 'save', '--provider', 'Fake'])
    // `provider` is the discriminator the server routes the body by.
    expect(body).toEqual({integration: {provider: 'Fake', integrationName: '', isEnabled: true}})
  })

  it('merges --config into the integration and keeps the flags on top', async () => {
    const body = await bodyOf([
      'integration',
      'save',
      '--provider',
      'Fake',
      '--id',
      ID,
      '--disabled',
      '--config',
      '{"provider":"AppleApns","note":"x"}',
    ])
    expect(body).toEqual({integration: {provider: 'Fake', note: 'x', integrationId: ID, integrationName: '', isEnabled: false}})
  })

  it('rejects a provider the server does not know', async () => {
    const {error} = await runCommand(['push', 'integration', 'save', '--provider', 'Nope', ...globalArgs])
    expect(error?.message).toMatch(/Expected --provider=Nope to be one of/)
    expect(calls).toHaveLength(0)
  })
})

describe('push integration confirm-delivery / app-request', () => {
  it('sends the integration id in the body', async () => {
    expect(await bodyOf(['integration', 'confirm-delivery', ID])).toEqual({integrationId: ID})
  })

  it('sends the pairing fields', async () => {
    const body = await bodyOf([
      'integration', 'app-request', '--user', 'usr_1', '--request-id', 'req_1', '--pin', '123456',
      '--valid-till', '2026-09-20T12:00:00Z', '--public-key', 'pk', '--account', 'acc_1',
    ])
    expect(body).toMatchObject({
      accountId: 'acc_1', userId: 'usr_1', requestId: 'req_1', pin: 123456,
      validTill: '2026-09-20T12:00:00Z', publicKey: 'pk',
    })
  })
})

it('push integration app-request fails before sending when no account is set', async () => {
  const {error} = await runCommand([
    'push', 'integration', 'app-request', '--user', 'usr_1', '--request-id', 'req_1', '--pin', '1',
    '--valid-till', '2026-09-20T12:00:00Z', '--public-key', 'pk', ...globalArgs,
  ])
  expect(error?.message).toMatch(/account-scoped/)
  expect(calls).toHaveLength(0)
})

describe('push template create / update', () => {
  it('builds one translation from --title and --body', async () => {
    const body = await bodyOf(['template', 'create', '--name', 'Welcome', '--title', 'Hi', '--body', 'Thanks', '--tag', 'a', '--tag', 'b'])
    expect(body).toEqual({
      templateName: 'Welcome',
      communicationChannel: 'Transactional',
      tags: ['a', 'b'],
      translations: [{language: 'en', content: {title: 'Hi', body: 'Thanks'}}],
    })
  })

  it('takes several languages from --translations', async () => {
    const translations = [
      {language: 'en', content: {title: 'Hi', body: 'Thanks'}},
      {language: 'lt', content: {title: 'Labas', body: 'Ačiū'}},
    ]
    const body = await bodyOf(['template', 'create', '--name', 'Welcome', '--translations', JSON.stringify(translations)])
    expect(body.translations).toEqual(translations)
  })

  it('refuses to send a template with no content', async () => {
    const {error} = await runCommand(['push', 'template', 'create', '--name', 'Welcome', ...globalArgs])
    expect(error?.message).toMatch(/--title and --body/)
    expect(calls).toHaveLength(0)
  })

  it('sends the template id as viewId on update', async () => {
    const body = await bodyOf(['template', 'update', ID, '--name', 'Welcome', '--channel', 'Marketing', '--title', 'Hi', '--body', 'Thanks'])
    expect(body).toMatchObject({viewId: ID, templateName: 'Welcome', communicationChannel: 'Marketing'})
  })
})

describe('push template render', () => {
  it('sends the code and the tokens as Custom mappings', async () => {
    const body = await bodyOf(['template', 'render', '--code', '@Model.Name', '--token', 'Name=Ada', '--preview'])
    expect(body).toEqual({
      code: '@Model.Name',
      tokens: [{key: 'Name', value: 'Ada', resolver: 'Custom'}],
      isForPreview: true,
    })
  })
})

describe('push campaign create — the five audiences', () => {
  // The server picks the body shape from `campaign.source`, so each audience
  // is checked on the wire, not just the flags.
  const cases: Array<[string, string[], Record<string, unknown>]> = [
    ['all-users', ['--tag', 'beta', '--role', 'Admin'], {source: 'allUsers', userTags: ['beta'], rolesNames: ['Admin']}],
    ['users', ['--user', 'usr_1', '--user', 'usr_2'], {source: 'specifiedUsers', userRecipients: ['usr_1', 'usr_2']}],
    ['account-users', ['--user', 'acc_usr_1'], {source: 'accountUsers', userRecipients: ['acc_usr_1']}],
    [
      'collection',
      ['--schema', 'subscribers', '--field', 'owner', '--field-type', 'User'],
      {source: 'collection', schemaName: 'subscribers', fields: ['owner'], fieldType: 'User'},
    ],
    ['devices', ['--device', 'dGVzdA==:Ios'], {source: 'devices', devices: [{token: 'dGVzdA==', deliveryFamily: 'Ios'}]}],
  ]

  for (const [audience, extra, expected] of cases) {
    it(`--audience ${audience}`, async () => {
      const body = await bodyOf(['campaign', 'create', '--template', ID, '--audience', audience, ...extra])
      expect(body.campaign).toEqual({templateId: ID, ...expected})
    })
  }

  it('passes schedule, tokens and the rest of the options', async () => {
    const body = await bodyOf([
      'campaign', 'create', '--template', ID, '--audience', 'all-users', '--integration', 'int_1',
      '--language', 'lt', '--notes', 'n', '--at', '2026-09-20T12:00:00Z', '--token', 'Code=42',
      '--database-integration', 'db_1',
    ])
    expect(body).toEqual({
      campaign: {
        source: 'allUsers', templateId: ID, integrationId: 'int_1', language: 'lt', notes: 'n',
        campaignTime: 1789905600, mappedTokens: [{key: 'Code', value: '42', resolver: 'Custom'}],
      },
      databaseIntegrationId: 'db_1',
    })
  })

  const missing: Array<[string, string[], RegExp]> = [
    ['users', [], /needs at least one --user/],
    ['collection', ['--schema', 's'], /needs --schema and --field/],
    ['devices', [], /needs at least one --device/],
    ['devices', ['--device', 'no-family'], /must look like <token>:<family>/],
  ]
  for (const [audience, extra, message] of missing) {
    it(`--audience ${audience} ${extra.join(' ')} fails before sending`, async () => {
      const {error} = await runCommand(['push', 'campaign', 'create', '--template', ID, '--audience', audience, ...extra, ...globalArgs])
      expect(error?.message).toMatch(message)
      expect(calls).toHaveLength(0)
    })
  }
})

describe('push campaign reads', () => {
  it('message sends the batch and the message id the server binds', async () => {
    await bodyOf(['campaign', 'message', ID, MESSAGE, '--batch', BATCH])
    expect(calls[0]?.query.get('campaignBatchId')).toBe(BATCH)
    expect(calls[0]?.query.get('notificationId')).toBe(MESSAGE)
  })

  it('batches pass paging', async () => {
    await bodyOf(['campaign', 'batches', ID, '--page-size', '10', '--after', 'cur_1'])
    expect(calls[0]?.query.get('pageSize')).toBe('10')
    expect(calls[0]?.query.get('startingAfter')).toBe('cur_1')
  })
})
