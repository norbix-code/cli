import {runCommand as runOclif} from '@oclif/test'
import {Config} from '@oclif/core'
import {fileURLToPath} from 'node:url'
import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import EmailCampaignBatch from '../src/commands/email/campaign/batch.js'
import EmailCampaignBatches from '../src/commands/email/campaign/batches.js'
import EmailCampaignDelete from '../src/commands/email/campaign/delete.js'
import EmailCampaignMessages from '../src/commands/email/campaign/messages.js'
import EmailDisable from '../src/commands/email/disable.js'
import EmailDisableDependencies from '../src/commands/email/disable-dependencies.js'
import EmailEnable from '../src/commands/email/enable.js'
import EmailFooter from '../src/commands/email/footer.js'
import EmailFooterDelete from '../src/commands/email/footer/delete.js'
import EmailFooterSave from '../src/commands/email/footer/save.js'
import EmailFooters from '../src/commands/email/footers.js'
import EmailIntegration from '../src/commands/email/integration.js'
import EmailIntegrationConfirmDelivery from '../src/commands/email/integration/confirm-delivery.js'
import EmailIntegrationDefault from '../src/commands/email/integration/default.js'
import EmailIntegrationDelete from '../src/commands/email/integration/delete.js'
import EmailIntegrationDisable from '../src/commands/email/integration/disable.js'
import EmailIntegrationDomainHealth from '../src/commands/email/integration/domain-health.js'
import EmailIntegrationEnable from '../src/commands/email/integration/enable.js'
import EmailIntegrationTest from '../src/commands/email/integration/test.js'
import EmailIntegrations from '../src/commands/email/integrations.js'
import EmailPreview from '../src/commands/email/preview.js'
import EmailSettings from '../src/commands/email/settings.js'
import EmailSignature from '../src/commands/email/signature.js'
import EmailSignatureDelete from '../src/commands/email/signature/delete.js'
import EmailSignatureSave from '../src/commands/email/signature/save.js'
import EmailSignatures from '../src/commands/email/signatures.js'
import EmailSystemTemplate from '../src/commands/email/system-template.js'
import EmailSystemTemplates from '../src/commands/email/system-templates.js'
import EmailTemplateAttach from '../src/commands/email/template/attach.js'
import EmailTemplateRender from '../src/commands/email/template/render.js'
import EmailTemplateTokens from '../src/commands/email/template/tokens.js'
import EmailValidationTest from '../src/commands/email/validation/test.js'
import {runCommand} from './_helpers.js'

const ID = '66b2f0a1'
const BATCH = 'b7c3'
const MESSAGE = 'n9d4'

describe('email module', () => {
  it('enable turns the module on', async () => {
    const {calls, output} = await runCommand(EmailEnable, [])
    expect(calls).toEqual([{method: 'enableEmail', request: {}}])
    expect(output).toEqual(['Email enabled.'])
  })

  it('disable --yes turns the module off', async () => {
    const {calls, output} = await runCommand(EmailDisable, ['--yes'])
    expect(calls).toEqual([{method: 'disableEmail', request: {}}])
    expect(output).toEqual(['Email disabled.'])
  })

  it('disable-dependencies lists what still depends on email', async () => {
    const {calls} = await runCommand(EmailDisableDependencies, [])
    expect(calls).toEqual([{method: 'getEmailDisableDependencies', request: {}}])
  })

  it('settings reads the project settings, or the one named with --id', async () => {
    expect((await runCommand(EmailSettings, [])).calls).toEqual([{method: 'getEmailSettings', request: {}}])
    expect((await runCommand(EmailSettings, ['--id', ID])).calls[0]?.request).toEqual({id: ID})
  })
})

describe('email integrations', () => {
  it('lists with paging', async () => {
    const {calls} = await runCommand(EmailIntegrations, ['--page-size', '50', '--after', 'cur_1'])
    expect(calls).toEqual([{method: 'getEmailIntegrations', request: {pageSize: 50, startingAfter: 'cur_1'}}])
  })

  it('shows one integration', async () => {
    const {calls} = await runCommand(EmailIntegration, [ID])
    expect(calls).toEqual([{method: 'getEmailIntegration', request: {id: ID}}])
  })

  const byId = [
    {command: EmailIntegrationEnable, argv: [ID], method: 'enableEmailIntegration', request: {id: ID}, output: `Integration ${ID} enabled.`},
    {command: EmailIntegrationDisable, argv: [ID, '--yes'], method: 'disableEmailIntegration', request: {id: ID}, output: `Integration ${ID} disabled.`},
    {command: EmailIntegrationDefault, argv: [ID], method: 'setEmailsIntegrationAsDefault', request: {id: ID}, output: `Integration ${ID} is now the default.`},
    {command: EmailIntegrationDelete, argv: [ID, '--yes'], method: 'deleteEmailIntegration', request: {id: ID}, output: `Integration ${ID} deleted.`},
    {
      command: EmailIntegrationConfirmDelivery,
      argv: [ID],
      method: 'confirmEmailIntegrationHumanDelivery',
      request: {integrationId: ID},
      output: `Delivery confirmed for integration ${ID}.`,
    },
  ]
  for (const {command, argv, method, request, output} of byId) {
    it(`${method} sends ${JSON.stringify(request)}`, async () => {
      const result = await runCommand(command, argv)
      expect(result.calls).toEqual([{method, request}])
      expect(result.output).toEqual([output])
    })
  }

  it('domain-health checks the integration by id', async () => {
    const {calls} = await runCommand(EmailIntegrationDomainHealth, [ID])
    expect(calls).toEqual([{method: 'checkEmailIntegrationDomainHealth', request: {integrationId: ID}}])
  })

  it('test sends the integration id and the address', async () => {
    const {calls} = await runCommand(EmailIntegrationTest, ['--integration', ID, '--to', 'dev@example.com'])
    expect(calls).toEqual([{method: 'testEmailIntegration', request: {integrationId: ID, to: 'dev@example.com'}}])
  })

  it('test needs an address', async () => {
    await expect(runCommand(EmailIntegrationTest, ['--integration', ID])).rejects.toThrow(/Missing required flag to/)
  })
})

describe('email validation integrations', () => {
  it('test checks the validation integration by id', async () => {
    const {calls} = await runCommand(EmailValidationTest, [ID])
    expect(calls).toEqual([{method: 'testEmailValidationIntegration', request: {integrationId: ID}}])
  })
})

describe('email footers and signatures', () => {
  const kinds = [
    {name: 'footer', list: EmailFooters, get: EmailFooter, save: EmailFooterSave, del: EmailFooterDelete, K: 'Footer'},
    {name: 'signature', list: EmailSignatures, get: EmailSignature, save: EmailSignatureSave, del: EmailSignatureDelete, K: 'Signature'},
  ]

  for (const {name, list, get, save, del, K} of kinds) {
    it(`${name}s lists with paging`, async () => {
      const {calls} = await runCommand(list, ['--page-size', '5'])
      expect(calls).toEqual([{method: `getEmail${K}s`, request: {pageSize: 5, startingAfter: undefined}}])
    })

    it(`${name} shows one`, async () => {
      const {calls} = await runCommand(get, [ID])
      expect(calls).toEqual([{method: `getEmail${K}`, request: {id: ID}}])
    })

    it(`${name} save builds one translation from --content`, async () => {
      const {calls} = await runCommand(save, ['--name', 'Default', '--content', '<p>Bye @Model.Name</p>', '--language', 'lt'])
      expect(calls).toEqual([
        {
          method: `saveEmail${K}`,
          request: {viewId: undefined, displayName: 'Default', translations: [{language: 'lt', content: '<p>Bye @Model.Name</p>'}]},
        },
      ])
    })

    it(`${name} save reads --content-file and sends --id to update`, async () => {
      const dir = mkdtempSync(join(tmpdir(), 'norbix-email-'))
      const file = join(dir, `${name}.html`)
      writeFileSync(file, '<p>From a file</p>')
      const {calls} = await runCommand(save, ['--id', ID, '--name', 'Default', '--content-file', file])
      expect(calls[0]?.request).toEqual({viewId: ID, displayName: 'Default', translations: [{language: 'en', content: '<p>From a file</p>'}]})
    })

    it(`${name} save takes several languages from --translations`, async () => {
      const translations = [
        {language: 'en', content: '<p>Bye</p>'},
        {language: 'lt', content: '<p>Viso</p>'},
      ]
      const {calls} = await runCommand(save, ['--name', 'Default', '--translations', JSON.stringify(translations)])
      expect(calls[0]?.request).toEqual({viewId: undefined, displayName: 'Default', translations})
    })

    it(`${name} save refuses to send no content`, async () => {
      await expect(runCommand(save, ['--name', 'Default'])).rejects.toThrow(/--content/)
    })

    it(`${name} delete --yes deletes it`, async () => {
      const {calls, output} = await runCommand(del, [ID, '--yes'])
      expect(calls).toEqual([{method: `deleteEmail${K}`, request: {id: ID}}])
      expect(output).toEqual([`${K} ${ID} deleted.`])
    })
  }
})

describe('email system templates', () => {
  it('lists with filters', async () => {
    const {calls} = await runCommand(EmailSystemTemplates, [
      '--tag', 'onboarding', '--tag', 'newsletter', '--theme', 'dark', '--channel', 'Marketing', '--trigger', 'Membership',
    ])
    expect(calls).toEqual([
      {
        method: 'getSystemEmailTemplates',
        request: {
          groupTags: ['onboarding', 'newsletter'],
          themes: ['dark'],
          communicationChannel: 'Marketing',
          forTrigger: 'Membership',
          pageSize: undefined,
          startingAfter: undefined,
        },
      },
    ])
  })

  it('shows one', async () => {
    const {calls} = await runCommand(EmailSystemTemplate, [ID])
    expect(calls).toEqual([{method: 'getSystemEmailTemplate', request: {id: ID}}])
  })
})

describe('email template tokens / render / attach', () => {
  it('tokens lists the tokens of a template', async () => {
    const {calls} = await runCommand(EmailTemplateTokens, [ID])
    expect(calls).toEqual([{method: 'getEmailTemplateAvailableTokens', request: {id: ID}}])
  })

  it('render sends the code from a file with the tokens as Custom mappings', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'norbix-email-'))
    const file = join(dir, 'welcome.mjml')
    writeFileSync(file, '<mjml><mj-body><mj-text>Hi @Model.Name</mj-text></mj-body></mjml>')
    const {calls} = await runCommand(EmailTemplateRender, ['--file', file, '--token', 'Name=Ada', '--preview'])
    expect(calls).toEqual([
      {
        method: 'getMjml',
        request: {
          code: '<mjml><mj-body><mj-text>Hi @Model.Name</mj-text></mj-body></mjml>',
          tokens: [{key: 'Name', value: 'Ada', resolver: 'Custom'}],
          isForPreview: true,
        },
      },
    ])
  })

  it('render needs --code or --file', async () => {
    await expect(runCommand(EmailTemplateRender, [])).rejects.toThrow(/--code or --file/)
  })

  it('attach sends the template id, the language and the file reference', async () => {
    const fileRef = {integrationId: 'fi_1', provider: 'Fake', path: 'terms.pdf', isPublic: false, resource: {id: 'r_1'}}
    const {calls, output} = await runCommand(EmailTemplateAttach, [ID, '--file-ref', JSON.stringify(fileRef), '--language', 'lt'])
    expect(calls).toEqual([{method: 'attachFileToTemplate', request: {templateId: ID, language: 'lt', fileRef}}])
    expect(output).toEqual([`File attached to template ${ID}.`])
  })
})

describe('email campaign reads and delete', () => {
  it('batches filter by batch and address and page', async () => {
    const {calls} = await runCommand(EmailCampaignBatches, [ID, '--batch', BATCH, '--email', 'ada@example.com', '--page-size', '10'])
    expect(calls).toEqual([
      {
        method: 'getEmailCampaignBatches',
        request: {id: ID, batchId: BATCH, emailAddress: 'ada@example.com', databaseIntegrationId: undefined, pageSize: 10, startingAfter: undefined},
      },
    ])
  })

  it('batch lists the notifications of a batch', async () => {
    const {calls} = await runCommand(EmailCampaignBatch, [ID, BATCH])
    expect(calls).toEqual([
      {
        method: 'getEmailCampaignBatchNotifications',
        request: {id: ID, batchId: BATCH, databaseIntegrationId: undefined, pageSize: undefined, startingAfter: undefined},
      },
    ])
  })

  it('batch with a notification id shows that one', async () => {
    const {calls} = await runCommand(EmailCampaignBatch, [ID, BATCH, MESSAGE])
    expect(calls).toEqual([
      {
        method: 'getEmailCampaignBatchNotification',
        request: {id: ID, batchId: BATCH, notificationId: MESSAGE, databaseIntegrationId: undefined},
      },
    ])
  })

  it('messages lists the e-mails of one batch', async () => {
    const {calls} = await runCommand(EmailCampaignMessages, [ID, '--batch', BATCH, '--database-integration', 'db_1'])
    expect(calls).toEqual([
      {
        method: 'getEmailCampaignMessages',
        request: {campaignId: ID, campaignBatchId: BATCH, databaseIntegrationId: 'db_1', pageSize: undefined, startingAfter: undefined},
      },
    ])
  })

  it('messages requires the batch (the request type needs it)', async () => {
    await expect(runCommand(EmailCampaignMessages, [ID])).rejects.toThrow(/Missing required flag batch/)
  })

  it('delete --yes deletes the campaign', async () => {
    const {calls, output} = await runCommand(EmailCampaignDelete, [ID, '--yes'])
    expect(calls).toEqual([{method: 'deleteEmailCampaign', request: {id: ID}}])
    expect(output).toEqual([`Campaign ${ID} deleted.`])
  })
})

describe('email preview', () => {
  it('sends the preview hash', async () => {
    const {calls} = await runCommand(EmailPreview, ['8f2a91c4'])
    expect(calls).toEqual([{method: 'previewEmailNotification', request: {hash: '8f2a91c4'}}])
  })

  it('takes the hash from --hash too', async () => {
    const {calls} = await runCommand(EmailPreview, ['--hash', 'abc.def'])
    expect(calls).toEqual([{method: 'previewEmailNotification', request: {hash: 'abc.def'}}])
  })

  it('--notification asks for one notification of the project', async () => {
    const {calls} = await runCommand(EmailPreview, ['--notification', MESSAGE, '--project', 'p-1'])
    expect(calls).toEqual([{method: 'previewEmailNotification', request: {projectId: 'p-1', notificationId: MESSAGE}}])
  })

  it('refuses a hash and --notification together', async () => {
    await expect(runCommand(EmailPreview, ['abc.def', '--notification', MESSAGE])).rejects.toThrow(/not both/)
  })

  it('refuses to run with nothing to preview', async () => {
    await expect(runCommand(EmailPreview, [])).rejects.toThrow(/preview hash/)
  })
})

/**
 * The signed preview link opens without sign-in: the hash is the key. These run
 * the real command through oclif and the real `@norbix.ai/ts` transport, with
 * `fetch` replaced — nothing leaves the process. The test HOME is empty (see
 * test/setup.ts), so there is no login session and no profile.
 */
describe('email preview — signed link, no login, no project', () => {
  interface Sent {
    url: URL
    headers: Headers
  }

  let sent: Sent[]
  let realFetch: typeof globalThis.fetch

  beforeEach(() => {
    sent = []
    realFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      sent.push({url: new URL(href), headers: new Headers(init?.headers)})
      return new Response(JSON.stringify({subject: 'Hi Ada', body: '<p>Hi Ada</p>'}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      })
    }) as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('does not ask for a login or a project, and sends neither', async () => {
    const {error} = await runOclif(['email', 'preview', '--hash', 'abc.def', '--region', 'nb-eu-germany'])

    expect(error).toBeUndefined()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.url.pathname).toBe('/v3/notifications/email/preview')
    expect(sent[0]!.url.searchParams.get('hash')).toBe('abc.def')
    expect(sent[0]!.headers.get('Authorization')).toBeNull()
    expect(sent[0]!.headers.get('norbix-project-id')).toBeNull()
  })

  it('--notification still needs a login', async () => {
    const {error} = await runOclif(['email', 'preview', '--notification', 'n9d4', '--project', 'p-1', '--region', 'nb-eu-germany'])

    expect(error?.message).toMatch(/Not authenticated/)
    expect(sent).toHaveLength(0)
  })
})

it('every sms command has an email twin, except `campaign message`', async () => {
  // Same shape across the three channels: a command learnt for SMS works for
  // e-mail. `campaign message` is the one SMS / push alias Email never had —
  // its route was removed before Email got a CLI command for it.
  const config = await Config.load(fileURLToPath(new URL('..', import.meta.url)))
  const sms = config.commandIDs.filter((id) => id.startsWith('sms:') && id !== 'sms:campaign:message')
  const missing = sms.map((id) => id.replace(/^sms:/, 'email:')).filter((id) => !config.findCommand(id))
  expect(sms.length).toBeGreaterThan(30)
  expect(missing).toEqual([])
})
