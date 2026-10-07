import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

/**
 * One row per Email endpoint that has a command: run the command the way a user
 * types it, through oclif and the real `@norbix.ai/ts` transport, and check the
 * verb and path of the request it sends.
 *
 * `email.test.ts` and `email-existing.test.ts` swap the SDK for a recorder,
 * which cannot see route tokens. Here the request goes all the way to `fetch`,
 * which is replaced, so nothing leaves the process and no mail service is
 * contacted. The only provider a test saves is Fake.
 */

const ID = '66b2f0a1'
/** Every campaign create names its provider — the server never falls back (CM-ERRORS-INTEGRATIONS-003). */
const INT = 'int_1'
const BATCH = 'b7c3'
const MESSAGE = 'n9d4'
const TO = 'dev@example.com'

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

const P = '/v2/notifications/email'

/** [argv, verb, path] — argv without the leading `email`. */
const routes: Array<[string[], string, string]> = [
  // Module
  [['settings'], 'GET', `${P}/settings`],
  [['enable'], 'PUT', `${P}/enable`],
  [['disable', '--yes'], 'PUT', `${P}/disable`],
  [['disable-dependencies'], 'GET', `${P}/disable-dependencies`],

  // Integrations
  [['integrations'], 'GET', `${P}/integrations`],
  [['integration', ID], 'GET', `${P}/integrations/${ID}`],
  [['integration', 'save', '--provider', 'Fake'], 'POST', `${P}/integrations`],
  [['integration', 'enable', ID], 'PUT', `${P}/integrations/${ID}/enable`],
  [['integration', 'disable', ID, '--yes'], 'PUT', `${P}/integrations/${ID}/disable`],
  [['integration', 'default', ID], 'PUT', `${P}/integrations/${ID}/default`],
  [['integration', 'delete', ID, '--yes'], 'DELETE', `${P}/integrations/${ID}`],
  [['integration', 'test', '--integration', ID, '--to', TO], 'POST', `${P}/integrations/test`],
  [['integration', 'confirm-delivery', ID], 'POST', `${P}/integrations/confirm-human-delivery`],
  [['integration', 'domain-health', ID], 'POST', `${P}/integrations/domain-health`],

  // Validation integrations
  [['validation', 'save', '--provider', 'ZeroBounce', '--name', 'ZeroBounce'], 'POST', `${P}/validation/integrations`],
  [['validation', 'test', ID], 'POST', `${P}/validation/integrations/test`],

  // Footers and signatures
  [['footers'], 'GET', `${P}/footers`],
  [['footer', ID], 'GET', `${P}/footers/${ID}`],
  [['footer', 'save', '--name', 'Default', '--content', '<p>Bye</p>'], 'POST', `${P}/footers`],
  [['footer', 'delete', ID, '--yes'], 'DELETE', `${P}/footers/${ID}`],
  [['signatures'], 'GET', `${P}/signatures`],
  [['signature', ID], 'GET', `${P}/signatures/${ID}`],
  [['signature', 'save', '--name', 'Default', '--content', '<p>Ada</p>'], 'POST', `${P}/signatures`],
  [['signature', 'delete', ID, '--yes'], 'DELETE', `${P}/signatures/${ID}`],

  // Templates
  [['templates'], 'GET', `${P}/templates`],
  [['template', ID], 'GET', `${P}/templates/${ID}`],
  [['archive', ID], 'PUT', `${P}/templates/${ID}/archive`],
  [['unarchive', ID], 'PUT', `${P}/templates/${ID}/unarchive`],
  [['clone', ID], 'POST', `${P}/templates/${ID}/clone`],
  [['delete', ID, '--yes'], 'DELETE', `${P}/templates/${ID}`],
  [['template', 'create', '--name', 'Welcome', '--subject', 'Hi', '--body', '<mjml></mjml>'], 'POST', `${P}/templates`],
  [['template', 'update', ID, '--name', 'Welcome', '--subject', 'Hi', '--body', '<mjml></mjml>'], 'PUT', `${P}/templates`],
  [['template', 'tokens', ID], 'GET', `${P}/templates/${ID}/tokens`],
  [['template', 'render', '--code', '<mjml></mjml>', '--token', 'Name=Ada'], 'POST', `${P}/templates/mjml`],
  [['template', 'attach', ID, '--file-ref', '{"path":"terms.pdf"}'], 'POST', `${P}/templates/attachments`],
  [['system-templates'], 'GET', `${P}/system-templates`],
  [['system-template', ID], 'GET', `${P}/system-templates/${ID}`],

  // Campaigns
  [['campaigns'], 'GET', `${P}/campaigns`],
  [['campaign', ID], 'GET', `${P}/campaigns/${ID}`],
  [['campaign', ID, '--stats'], 'GET', `${P}/campaigns/${ID}/stats`],
  [['campaign', 'create', '--template', ID, '--integration', INT, '--audience', 'all-users'], 'POST', `${P}/campaigns`],
  [['campaign', 'delete', ID, '--yes'], 'DELETE', `${P}/campaigns/${ID}`],
  [['stop', ID, '--yes'], 'POST', `${P}/campaigns/${ID}/stop`],
  [['campaign', 'batches', ID], 'GET', `${P}/campaigns/${ID}/batches`],
  [['campaign', 'batch', ID, BATCH], 'GET', `${P}/campaigns/${ID}/batches/${BATCH}`],
  [['campaign', 'batch', ID, BATCH, MESSAGE], 'GET', `${P}/campaigns/${ID}/batches/${BATCH}/${MESSAGE}`],
  // The gateway spells this one route `emails` (plural).
  [['campaign', 'messages', ID, '--batch', BATCH], 'GET', `/v2/notifications/emails/campaigns/${ID}/messages`],
  [['preview', '8f2a91c4'], 'GET', `${P}/preview`],
  [['preview', '--notification', MESSAGE], 'GET', `${P}/preview`],
]

describe('every email command reaches its route', () => {
  for (const [argv, verb, path] of routes) {
    it(`email ${argv.join(' ')} → ${verb} ${path}`, async () => {
      const {error} = await runCommand(['email', ...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe(verb)
      expect(calls[0]?.path).toBe(path)
    })
  }
})

it('covers 48 of the 51 Email routes', () => {
  // The gateway's Hub.Emails project has 51 [Route] attributes; the manifest
  // (sdks/typegen/coverage/endpoints.hub.json) lists 49 of them (it leaves out
  // the one-click unsubscribe and the Mailgun webhook). Three have no command
  // on purpose — see "No command on purpose" in docs/email.md:
  // GET /{version}/email/preferences, POST /{version}/email/one-click-unsubscribe,
  // POST /{version}/email/webhooks/mailgun/{projectId}/{integrationId}.
  // The two `preview` rows (hash and --notification) share one route, so count
  // distinct verb + path pairs: 49 rows, 48 routes.
  expect(new Set(routes.map(([, verb, path]) => `${verb} ${path}`)).size).toBe(48)
})

/** Run a command and return the one request body it sent. */
// Note: @oclif/test's runCommand splits argv on spaces, so no test value here
// contains one.
async function bodyOf(argv: string[]): Promise<Record<string, unknown>> {
  const {error} = await runCommand(['email', ...argv, ...globalArgs])
  expect(error).toBeUndefined()
  expect(calls).toHaveLength(1)
  return calls[0]?.body ?? {}
}

describe('email integration save', () => {
  it('saves the Fake provider with nothing else needed', async () => {
    const body = await bodyOf(['integration', 'save', '--provider', 'Fake'])
    // `provider` is the discriminator the server routes the body by; the Fake
    // needs no payload (Hub.Emails/Integrations/Save.Fake.cs builds its own
    // name, sender and address).
    expect(body).toEqual({integration: {provider: 'Fake', integrationName: '', isEnabled: true}})
  })

  it('merges --config into the integration and keeps the flags on top', async () => {
    const body = await bodyOf([
      'integration', 'save', '--provider', 'SendGrid', '--name', 'SendGrid', '--id', ID, '--disabled',
      '--from', 'hello@example.com', '--sender-name', 'Norbix', '--config', '{"provider":"Fake","apiKey":"SG.1"}',
    ])
    expect(body).toEqual({
      integration: {
        provider: 'SendGrid',
        apiKey: 'SG.1',
        integrationId: ID,
        integrationName: 'SendGrid',
        emailAddress: 'hello@example.com',
        emailSenderName: 'Norbix',
        isEnabled: false,
      },
    })
  })

  it('takes the sender from --config when no flag is given', async () => {
    const body = await bodyOf(['integration', 'save', '--provider', 'Smtp', '--config', '{"emailAddress":"a@example.com","port":587}'])
    expect(body.integration).toMatchObject({provider: 'Smtp', emailAddress: 'a@example.com', port: 587})
  })

  it('a viewId in --config (the output of `get`, wrapped in integration) updates that integration', async () => {
    const fromGet = {
      integration: {
        viewId: ID,
        integrationName: 'Main',
        isEnabled: false,
        env: 'PROD',
        lastIntegrationTestSucceeded: true,
        requiresHumanDeliveryConfirmation: false,
        provider: 'SendGrid',
        emailAddress: 'a@example.com',
        apiKey: 'SG.1',
      },
    }
    const body = await bodyOf(['integration', 'save', '--provider', 'SendGrid', '--config', JSON.stringify(fromGet)])
    expect(body).toEqual({
      integration: {
        provider: 'SendGrid',
        apiKey: 'SG.1',
        integrationId: ID,
        integrationName: 'Main',
        emailAddress: 'a@example.com',
        isEnabled: false,
      },
    })
  })

  it('a bare viewId in --config is the integrationId too; --id still wins', async () => {
    const bare = await bodyOf(['integration', 'save', '--provider', 'Smtp', '--config', `{"viewId":"${ID}"}`])
    expect(bare.integration).toMatchObject({integrationId: ID})
    expect(bare.integration).not.toHaveProperty('viewId')
    calls.length = 0
    const flag = await bodyOf(['integration', 'save', '--provider', 'Smtp', '--id', 'int_other', '--config', `{"viewId":"${ID}"}`])
    expect(flag.integration).toMatchObject({integrationId: 'int_other'})
  })

  it('rejects a provider the server does not know', async () => {
    const {error} = await runCommand(['email', 'integration', 'save', '--provider', 'Nope', ...globalArgs])
    expect(error?.message).toMatch(/Expected --provider=Nope to be one of/)
    expect(calls).toHaveLength(0)
  })
})

describe('email integration test / confirm-delivery / domain-health', () => {
  it('test sends the integration id and the address in the body', async () => {
    expect(await bodyOf(['integration', 'test', '--integration', ID, '--to', TO])).toEqual({integrationId: ID, to: TO})
  })

  it('confirm-delivery sends the integration id in the body', async () => {
    expect(await bodyOf(['integration', 'confirm-delivery', ID])).toEqual({integrationId: ID})
  })

  it('domain-health sends the integration id in the body', async () => {
    expect(await bodyOf(['integration', 'domain-health', ID])).toEqual({integrationId: ID})
  })
})

describe('email validation save / test', () => {
  it('sends the provider by name, not by the number the generated enum holds', async () => {
    // The server reads `provider` with JsonElement.GetString() (Hub.Emails/
    // Validation/Integrations/Save_.cs) — a number would fail to parse.
    const body = await bodyOf([
      'validation', 'save', '--provider', 'NeverBounce', '--name', 'NB', '--config', '{"apiKey":"k"}',
    ])
    expect(body).toEqual({integration: {provider: 'NeverBounce', apiKey: 'k', integrationName: 'NB', isEnabled: true}})
  })

  it('test sends the integration id in the body', async () => {
    expect(await bodyOf(['validation', 'test', ID])).toEqual({integrationId: ID})
  })
})

describe('email template create / update', () => {
  it('builds one MJML translation from --subject and --body', async () => {
    const body = await bodyOf([
      'template', 'create', '--name', 'Welcome', '--subject', 'Hi', '--body', '<mjml>@Model.Name</mjml>', '--tag', 'a',
    ])
    expect(body).toEqual({
      templateName: 'Welcome',
      communicationChannel: 'Transactional',
      tags: ['a'],
      translations: [{language: 'en', content: {subject: 'Hi', body: {code: '<mjml>@Model.Name</mjml>', templateEngine: 'Mjml'}}}],
    })
  })

  it('puts --language and --engine into the translation', async () => {
    const body = await bodyOf(['template', 'create', '--name', 'W', '--subject', 'Labas', '--body', '<p>x</p>', '--language', 'lt', '--engine', 'Razor'])
    expect(body.translations).toEqual([{language: 'lt', content: {subject: 'Labas', body: {code: '<p>x</p>', templateEngine: 'Razor'}}}])
  })

  it('takes several languages from --translations', async () => {
    const translations = [
      {language: 'en', content: {subject: 'Hi', body: {code: '<mjml/>', templateEngine: 'Mjml'}}},
      {language: 'lt', content: {subject: 'Labas', body: {code: '<mjml/>', templateEngine: 'Mjml'}}},
    ]
    const body = await bodyOf(['template', 'create', '--name', 'Welcome', '--translations', JSON.stringify(translations)])
    expect(body.translations).toEqual(translations)
  })

  it('refuses to send a template with no subject or body', async () => {
    const {error} = await runCommand(['email', 'template', 'create', '--name', 'Welcome', '--body', '<mjml/>', ...globalArgs])
    expect(error?.message).toMatch(/--subject and --body/)
    expect(calls).toHaveLength(0)
  })

  it('sends the template id as viewId on update', async () => {
    const body = await bodyOf(['template', 'update', ID, '--name', 'Welcome', '--channel', 'Marketing', '--subject', 'Hi', '--body', '<mjml/>'])
    expect(body).toMatchObject({viewId: ID, templateName: 'Welcome', communicationChannel: 'Marketing'})
  })
})

describe('email template render / attach', () => {
  it('render sends the code and the tokens as Custom mappings', async () => {
    const body = await bodyOf(['template', 'render', '--code', '<mjml>@Model.Name</mjml>', '--token', 'Name=Ada', '--preview'])
    expect(body).toEqual({
      code: '<mjml>@Model.Name</mjml>',
      tokens: [{key: 'Name', value: 'Ada', resolver: 'Custom'}],
      isForPreview: true,
    })
  })

  it('attach sends the template id and the file reference in the body', async () => {
    const body = await bodyOf(['template', 'attach', ID, '--file-ref', '{"path":"terms.pdf","provider":"Fake"}'])
    expect(body).toEqual({templateId: ID, fileRef: {path: 'terms.pdf', provider: 'Fake'}})
  })
})

describe('email campaign create — the five audiences', () => {
  // The server reads `campaign.source` and then the matching request subclass
  // (Hub.Emails/Campaigns/Create_.cs EmailCampaignRequestDtoJsonConverter), so
  // each audience is checked on the wire, not just the flags.
  const cases: Array<[string, string[], Record<string, unknown>]> = [
    ['all-users', ['--tag', 'beta', '--role', 'Admin'], {source: 'AllUsers', rolesNames: ['Admin'], userTags: ['beta']}],
    [
      'users',
      ['--user', 'usr_1', '--user', 'usr_2', '--cc', 'usr_3', '--one-each'],
      {source: 'SpecifiedUsers', userRecipients: ['usr_1', 'usr_2'], userCc: ['usr_3'], singleEmailStrategy: true},
    ],
    ['account-users', ['--user', 'usr_1'], {source: 'AccountUsers', userRecipients: ['usr_1'], singleEmailStrategy: false}],
    [
      'emails',
      ['--email', 'ada@example.com', '--bcc', 'audit@example.com'],
      {source: 'Email', recipients: ['ada@example.com'], recipientsBcc: ['audit@example.com'], singleEmailStrategy: false},
    ],
    [
      'collection',
      ['--schema', 'subscribers', '--field', 'email', '--field-type', 'Email', '--role', 'Member'],
      {source: 'Collection', schemaName: 'subscribers', fields: ['email'], fieldType: 'Email', roleNames: ['Member']},
    ],
  ]

  for (const [audience, extra, fields] of cases) {
    it(`--audience ${audience} → source ${fields.source as string}`, async () => {
      const body = await bodyOf(['campaign', 'create', '--template', ID, '--integration', INT, '--audience', audience, ...extra])
      expect(body).toEqual({campaign: {templateId: ID, integrationId: INT, ...fields}})
    })
  }

  it('passes schedule, tokens, language, notes, both integrations and the database integration', async () => {
    const body = await bodyOf([
      'campaign', 'create', '--template', ID, '--integration', INT, '--audience', 'all-users', '--language', 'lt', '--notes', 'launch',
      '--at', '2026-09-20T12:00:00Z', '--token', 'Code=42', '--initiator', 'usr_7',
      '--validation-integration', 'val_1', '--database-integration', 'db_1',
    ])
    expect(body).toEqual({
      databaseIntegrationId: 'db_1',
      campaign: {
        source: 'AllUsers',
        templateId: ID,
        integrationId: 'int_1',
        validationIntegrationId: 'val_1',
        language: 'lt',
        initiatorId: 'usr_7',
        notes: 'launch',
        campaignTime: 1789905600,
        mappedTokens: [{key: 'Code', value: '42', resolver: 'Custom'}],
      },
    })
  })

  it('merges --config into the campaign and keeps the flags on top', async () => {
    const body = await bodyOf([
      'campaign', 'create', '--template', ID, '--integration', INT, '--audience', 'emails', '--email', 'ada@example.com',
      '--config', '{"recipients":["ignored"],"initiatorId":"usr_9"}',
    ])
    expect(body.campaign).toEqual({
      source: 'Email',
      templateId: ID,
      integrationId: INT,
      initiatorId: 'usr_9',
      recipients: ['ada@example.com'],
      singleEmailStrategy: false,
    })
  })

  it('refuses a missing --integration before any request (the server never picks the default)', async () => {
    const {error} = await runCommand(['email', 'campaign', 'create', '--template', ID, '--audience', 'all-users', ...globalArgs])
    expect(error?.message).toMatch(/Missing required flag integration/)
    expect(calls).toHaveLength(0)
  })

  it('--initiator wins over an initiatorId in --config', async () => {
    const body = await bodyOf([
      'campaign', 'create', '--template', ID, '--integration', INT, '--audience', 'all-users',
      '--initiator', 'usr_7', '--config', '{"initiatorId":"usr_9"}',
    ])
    expect((body.campaign as Record<string, unknown>).initiatorId).toBe('usr_7')
  })

  const missing: Array<[string, string[], RegExp]> = [
    ['users', [], /needs at least one --user/],
    ['account-users', [], /needs at least one --user/],
    ['emails', [], /needs at least one --email/],
    ['collection', ['--schema', 's'], /needs --schema and --field/],
  ]
  for (const [audience, extra, message] of missing) {
    it(`--audience ${audience} ${extra.join(' ')} fails before sending`, async () => {
      const {error} = await runCommand(['email', 'campaign', 'create', '--template', ID, '--integration', INT, '--audience', audience, ...extra, ...globalArgs])
      expect(error?.message).toMatch(message)
      expect(calls).toHaveLength(0)
    })
  }
})

describe('email campaign reads and preview', () => {
  it('messages sends the batch as a query field and fills the campaign token', async () => {
    await bodyOf(['campaign', 'messages', ID, '--batch', BATCH])
    expect(calls[0]?.query.get('campaignBatchId')).toBe(BATCH)
    expect(calls[0]?.query.get('campaignId')).toBeNull()
  })

  it('batches pass the filters and paging', async () => {
    await bodyOf(['campaign', 'batches', ID, '--email', 'ada@example.com', '--page-size', '10', '--after', 'cur_1'])
    expect(calls[0]?.query.get('emailAddress')).toBe('ada@example.com')
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

  it('preview --notification sends the project and the notification id, and no hash', async () => {
    await bodyOf(['preview', '--notification', MESSAGE])
    expect(calls[0]?.query.get('notificationId')).toBe(MESSAGE)
    expect(calls[0]?.query.get('projectId')).toBe('test-project')
    expect(calls[0]?.query.get('hash')).toBeNull()
  })
})
