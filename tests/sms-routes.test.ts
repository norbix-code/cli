import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

/**
 * One row per SMS endpoint: run the command the way a user types it, through
 * oclif and the real `@norbix.ai/ts` transport, and check the verb and path of
 * the request it sends.
 *
 * `sms.test.ts` and `sms-existing.test.ts` swap the SDK for a recorder, which
 * cannot see route tokens. Here the request goes all the way to `fetch`, which
 * is replaced, so nothing leaves the process and no SMS provider is contacted.
 * (The push campaign shipped a `stop` with the wrong token name behind a green
 * recorder test — this file is what catches that.)
 */

const ID = '66b2f0a1'
/** Every campaign create names its provider — the server never falls back (CM-ERRORS-INTEGRATIONS-003). */
const INT = 'int_1'
const BATCH = 'b7c3'
const MESSAGE = 'n9d4'
const PHONE = '+37060000000'

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

const P = '/v2/notifications/sms'

/** [argv, verb, path] — argv without the leading `sms`. */
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
  [['integration', 'disable', ID, '--yes'], 'PUT', `${P}/integrations/${ID}/disable`],
  [['integration', 'default', ID], 'PUT', `${P}/integrations/${ID}/default`],
  [['integration', 'delete', ID, '--yes'], 'DELETE', `${P}/integrations/${ID}`],
  [['integration', 'test', '--integration', ID, '--to', PHONE], 'POST', `${P}/integrations/test`],
  [['integration', 'save', '--provider', 'Fake'], 'POST', `${P}/integrations`],
  [['integration', 'confirm-delivery', ID], 'POST', `${P}/integrations/confirm-human-delivery`],

  // Templates
  [['templates'], 'GET', `${P}/templates`],
  [['template', ID], 'GET', `${P}/templates/${ID}`],
  [['archive', ID], 'PUT', `${P}/templates/${ID}/archive`],
  [['unarchive', ID], 'PUT', `${P}/templates/${ID}/unarchive`],
  [['clone', ID], 'POST', `${P}/templates/${ID}/clone`],
  [['delete', ID, '--yes'], 'DELETE', `${P}/templates/${ID}`],
  [['template', 'create', '--name', 'Welcome', '--body', 'Thanks'], 'POST', `${P}/templates`],
  [['template', 'update', ID, '--name', 'Welcome', '--body', 'Thanks'], 'PUT', `${P}/templates`],
  [['template', 'render', '--code', '@Model.Name', '--token', 'Name=Ada'], 'POST', `${P}/templates/render`],
  [['template', 'tokens', ID], 'GET', `${P}/templates/${ID}/tokens`],

  // Campaigns
  [['campaigns'], 'GET', `${P}/campaigns`],
  [['campaign', ID], 'GET', `${P}/campaigns/${ID}`],
  [['campaign', ID, '--stats'], 'GET', `${P}/campaigns/${ID}/stats`],
  [['preview', '8f2a91c4'], 'GET', `${P}/preview`],
  [['stop', ID, '--yes'], 'POST', `${P}/campaigns/${ID}/stop`],
  [['campaign', 'create', '--template', ID, '--integration', INT, '--audience', 'all-users'], 'POST', `${P}/campaigns`],
  [['campaign', 'delete', ID, '--yes'], 'DELETE', `${P}/campaigns/${ID}`],
  [['campaign', 'batches', ID], 'GET', `${P}/campaigns/${ID}/batches`],
  [['campaign', 'batch', ID, BATCH], 'GET', `${P}/campaigns/${ID}/batches/${BATCH}`],
  [['campaign', 'batch', ID, BATCH, MESSAGE], 'GET', `${P}/campaigns/${ID}/batches/${BATCH}/${MESSAGE}`],
  [['campaign', 'messages', ID, '--batch', BATCH], 'GET', `${P}/campaigns/${ID}/messages`],
  // `campaign message` reads the same batch route (the messages/{notificationId}
  // route was removed from the gateway and from @norbix.ai/ts 4.4.0).
  [['campaign', 'message', ID, MESSAGE, '--batch', BATCH], 'GET', `${P}/campaigns/${ID}/batches/${BATCH}/${MESSAGE}`],
]

describe('every sms command reaches its route', () => {
  for (const [argv, verb, path] of routes) {
    it(`sms ${argv.join(' ')} → ${verb} ${path}`, async () => {
      const {error} = await runCommand(['sms', ...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe(verb)
      expect(calls[0]?.path).toBe(path)
    })
  }
})

it('covers all 34 sms routes', () => {
  // The gateway's Hub.Sms project has 34 [Route] attributes and the manifest
  // (sdks/typegen/coverage/endpoints.hub.json) lists 34 Sms entries (the
  // campaign message route was removed; `campaign message` reads the batch
  // route). The campaign `--stats` row and `campaign message` share a route
  // with another row, so count distinct verb + path pairs.
  expect(new Set(routes.map(([, verb, path]) => `${verb} ${path}`)).size).toBe(34)
})

/** Run a command and return the one request body it sent. */
// Note: @oclif/test's runCommand splits argv on spaces, so no test value here
// contains one.
async function bodyOf(argv: string[]): Promise<Record<string, unknown>> {
  const {error} = await runCommand(['sms', ...argv, ...globalArgs])
  expect(error).toBeUndefined()
  expect(calls).toHaveLength(1)
  return calls[0]?.body ?? {}
}

describe('sms integration save', () => {
  it('saves the Fake provider with nothing else needed', async () => {
    const body = await bodyOf(['integration', 'save', '--provider', 'Fake'])
    // `provider` is the discriminator the server routes the body by; the Fake
    // needs no payload (Hub.Sms/Integrations/Save.Fake.cs).
    expect(body).toEqual({integration: {provider: 'Fake', integrationName: '', isEnabled: true}})
  })

  it('merges --config into the integration and keeps the flags on top', async () => {
    const body = await bodyOf([
      'integration', 'save', '--provider', 'Twilio', '--name', 'Twilio', '--id', ID, '--disabled',
      '--config', '{"provider":"Fake","accountSid":"AC1"}',
    ])
    expect(body).toEqual({
      integration: {provider: 'Twilio', accountSid: 'AC1', integrationId: ID, integrationName: 'Twilio', isEnabled: false},
    })
  })

  it('rejects a provider the server does not know', async () => {
    const {error} = await runCommand(['sms', 'integration', 'save', '--provider', 'Nope', ...globalArgs])
    expect(error?.message).toMatch(/Expected --provider=Nope to be one of/)
    expect(calls).toHaveLength(0)
  })
})

describe('sms integration test / confirm-delivery', () => {
  it('test sends the integration id and the phone number in the body', async () => {
    expect(await bodyOf(['integration', 'test', '--integration', ID, '--to', PHONE])).toEqual({integrationId: ID, to: PHONE})
  })

  it('confirm-delivery sends the integration id in the body', async () => {
    expect(await bodyOf(['integration', 'confirm-delivery', ID])).toEqual({integrationId: ID})
  })
})

describe('sms template create / update', () => {
  it('builds one translation from --body, with an empty subject like the portal', async () => {
    const body = await bodyOf(['template', 'create', '--name', 'Welcome', '--body', 'Thanks', '--tag', 'a', '--tag', 'b'])
    expect(body).toEqual({
      templateName: 'Welcome',
      communicationChannel: 'Transactional',
      tags: ['a', 'b'],
      translations: [{language: 'en', content: {subject: '', body: 'Thanks'}}],
    })
  })

  it('puts --subject and --language into the translation', async () => {
    const body = await bodyOf(['template', 'create', '--name', 'Welcome', '--subject', 'Norbix', '--body', 'Ačiū', '--language', 'lt'])
    expect(body.translations).toEqual([{language: 'lt', content: {subject: 'Norbix', body: 'Ačiū'}}])
  })

  it('takes several languages from --translations', async () => {
    const translations = [
      {language: 'en', content: {subject: '', body: 'Thanks'}},
      {language: 'lt', content: {subject: '', body: 'Ačiū'}},
    ]
    const body = await bodyOf(['template', 'create', '--name', 'Welcome', '--translations', JSON.stringify(translations)])
    expect(body.translations).toEqual(translations)
  })

  it('refuses to send a template with no text', async () => {
    const {error} = await runCommand(['sms', 'template', 'create', '--name', 'Welcome', ...globalArgs])
    expect(error?.message).toMatch(/--body/)
    expect(calls).toHaveLength(0)
  })

  it('sends the template id as viewId on update', async () => {
    const body = await bodyOf(['template', 'update', ID, '--name', 'Welcome', '--channel', 'Marketing', '--body', 'Thanks'])
    expect(body).toMatchObject({viewId: ID, templateName: 'Welcome', communicationChannel: 'Marketing'})
  })
})

describe('sms template render', () => {
  it('sends the code and the tokens as Custom mappings', async () => {
    const body = await bodyOf(['template', 'render', '--code', '@Model.Name', '--token', 'Name=Ada', '--preview'])
    expect(body).toEqual({
      code: '@Model.Name',
      tokens: [{key: 'Name', value: 'Ada', resolver: 'Custom'}],
      isForPreview: true,
    })
  })
})

describe('sms campaign create — the four audiences', () => {
  // The server reads `deliveryType` and then exactly the matching settings
  // block (Hub.Sms/Campaigns/Create.cs `Settings` switch), so each audience is
  // checked on the wire, not just the flags. This is NOT the push shape
  // (`campaign.source`): the Sms request is flat.
  const cases: Array<[string, string[], string, Record<string, unknown>]> = [
    ['all-users', ['--tag', 'beta', '--role', 'Admin'], 'allUsers', {recipientsSourceType: 'AllUsers', userTags: ['beta'], rolesNames: ['Admin']}],
    ['users', ['--user', 'usr_1', '--user', 'usr_2'], 'specifiedUsers', {recipientsSourceType: 'SpecifiedUsers', recipients: ['usr_1', 'usr_2']}],
    [
      'collection',
      ['--schema', 'subscribers', '--field', 'owner', '--field-type', 'User', '--role', 'Member'],
      'collection',
      {recipientsSourceType: 'Collection', schemaName: 'subscribers', fields: ['owner'], fieldType: 'User', roleNames: ['Member']},
    ],
    ['phone-numbers', ['--phone', PHONE, '--phone', '+37060000001'], 'phoneNumbers', {recipientsSourceType: 'PhoneNumbers', phoneNumbers: [PHONE, '+37060000001']}],
  ]

  for (const [audience, extra, block, settings] of cases) {
    it(`--audience ${audience} → deliveryType ${settings.recipientsSourceType as string} + ${block} block`, async () => {
      const body = await bodyOf(['campaign', 'create', '--template', ID, '--integration', INT, '--audience', audience, ...extra])
      expect(body).toEqual({templateId: ID, integrationId: INT, deliveryType: settings.recipientsSourceType, [block]: settings})
    })
  }

  it('passes schedule, time-zone rule, tokens, language and the database integration', async () => {
    const body = await bodyOf([
      'campaign', 'create', '--template', ID, '--integration', INT, '--audience', 'all-users', '--language', 'lt',
      '--at', '2026-09-20T12:00:00Z', '--respect-time-zone', 'registration', '--token', 'Code=42',
      '--initiator', 'usr_7', '--database-integration', 'db_1',
    ])
    expect(body).toEqual({
      templateId: ID,
      databaseIntegrationId: 'db_1',
      integrationId: INT,
      language: 'lt',
      initiatorId: 'usr_7',
      deliveryType: 'AllUsers',
      allUsers: {
        recipientsSourceType: 'AllUsers',
        campaignTime: 1789905600,
        respectTimeZoneSettings: 2,
        mappedTokens: [{key: 'Code', value: '42', resolver: 'Custom'}],
      },
    })
  })

  it('takes Unix seconds for --at as they are', async () => {
    const body = await bodyOf(['campaign', 'create', '--template', ID, '--integration', INT, '--audience', 'phone-numbers', '--phone', PHONE, '--at', '1789905600'])
    expect((body.phoneNumbers as Record<string, unknown>).campaignTime).toBe(1789905600)
  })

  it('merges --config into the settings block and keeps the flags on top', async () => {
    const body = await bodyOf([
      'campaign', 'create', '--template', ID, '--integration', INT, '--audience', 'users', '--user', 'usr_1',
      '--config', '{"recipients":["ignored"],"note":"x"}',
    ])
    expect(body.specifiedUsers).toEqual({recipientsSourceType: 'SpecifiedUsers', recipients: ['usr_1'], note: 'x'})
  })

  it('refuses a missing --integration before any request (the server never picks the default)', async () => {
    const {error} = await runCommand(['sms', 'campaign', 'create', '--template', ID, '--audience', 'all-users', ...globalArgs])
    expect(error?.message).toMatch(/Missing required flag integration/)
    expect(calls).toHaveLength(0)
  })

  const missing: Array<[string, string[], RegExp]> = [
    ['users', [], /needs at least one --user/],
    ['collection', ['--schema', 's'], /needs --schema and --field/],
    ['phone-numbers', [], /needs at least one --phone/],
  ]
  for (const [audience, extra, message] of missing) {
    it(`--audience ${audience} ${extra.join(' ')} fails before sending`, async () => {
      const {error} = await runCommand(['sms', 'campaign', 'create', '--template', ID, '--integration', INT, '--audience', audience, ...extra, ...globalArgs])
      expect(error?.message).toMatch(message)
      expect(calls).toHaveLength(0)
    })
  }

  it('refuses an audience the server does not have a settings block for', async () => {
    // The SmsCampaignRecipientsSourceTypes enum also lists AccountUsers, but
    // CreateSmsCampaignRequest has no `accountUsers` block, so the server would
    // answer IntegrationTypeNotSupportedError. The CLI does not offer it.
    const {error} = await runCommand(['sms', 'campaign', 'create', '--template', ID, '--integration', INT, '--audience', 'account-users', ...globalArgs])
    expect(error?.message).toMatch(/Expected --audience=account-users to be one of/)
    expect(calls).toHaveLength(0)
  })
})

describe('sms campaign reads', () => {
  it('message puts campaign, batch and message id into the batch route', async () => {
    // GET /campaigns/{campaignId}/messages/{notificationId} is gone from the
    // gateway; the batch route returns the same notification.
    await bodyOf(['campaign', 'message', ID, MESSAGE, '--batch', BATCH])
    expect(calls[0]?.path).toBe(`${P}/campaigns/${ID}/batches/${BATCH}/${MESSAGE}`)
    expect(calls[0]?.query.get('campaignBatchId')).toBeNull()
    expect(calls[0]?.query.get('notificationId')).toBeNull()
  })

  it('batches pass paging', async () => {
    await bodyOf(['campaign', 'batches', ID, '--page-size', '10', '--after', 'cur_1'])
    expect(calls[0]?.query.get('pageSize')).toBe('10')
    expect(calls[0]?.query.get('startingAfter')).toBe('cur_1')
  })

  it('templates --archived goes out as showArchived=true', async () => {
    await bodyOf(['templates', '--archived'])
    expect(calls[0]?.query.get('showArchived')).toBe('true')
  })

  it('preview sends the hash as a query field', async () => {
    await bodyOf(['preview', '8f2a91c4'])
    expect(calls[0]?.query.get('hash')).toBe('8f2a91c4')
  })
})
