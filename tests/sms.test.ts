import {runCommand as runOclif} from '@oclif/test'
import {Config} from '@oclif/core'
import {fileURLToPath} from 'node:url'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import SmsCampaignBatch from '../src/commands/sms/campaign/batch.js'
import SmsCampaignBatches from '../src/commands/sms/campaign/batches.js'
import SmsCampaignDelete from '../src/commands/sms/campaign/delete.js'
import SmsCampaignMessage from '../src/commands/sms/campaign/message.js'
import SmsCampaignMessages from '../src/commands/sms/campaign/messages.js'
import SmsDisable from '../src/commands/sms/disable.js'
import SmsDisableDependencies from '../src/commands/sms/disable-dependencies.js'
import SmsEnable from '../src/commands/sms/enable.js'
import SmsIntegration from '../src/commands/sms/integration.js'
import SmsIntegrationConfirmDelivery from '../src/commands/sms/integration/confirm-delivery.js'
import SmsIntegrationDefault from '../src/commands/sms/integration/default.js'
import SmsIntegrationDelete from '../src/commands/sms/integration/delete.js'
import SmsIntegrationDisable from '../src/commands/sms/integration/disable.js'
import SmsIntegrationEnable from '../src/commands/sms/integration/enable.js'
import SmsIntegrationTest from '../src/commands/sms/integration/test.js'
import SmsIntegrations from '../src/commands/sms/integrations.js'
import SmsPreview from '../src/commands/sms/preview.js'
import SmsSettings from '../src/commands/sms/settings.js'
import SmsTemplateRender from '../src/commands/sms/template/render.js'
import SmsTemplateTokens from '../src/commands/sms/template/tokens.js'
import {runCommand} from './_helpers.js'

const ID = '66b2f0a1'
const BATCH = 'b7c3'
const MESSAGE = 'n9d4'

describe('sms module', () => {
  it('enable turns the module on', async () => {
    const {calls, output} = await runCommand(SmsEnable, [])
    expect(calls).toEqual([{method: 'enableSms', request: {}}])
    expect(output).toEqual(['SMS enabled.'])
  })

  it('disable --yes turns the module off', async () => {
    const {calls, output} = await runCommand(SmsDisable, ['--yes'])
    expect(calls).toEqual([{method: 'disableSms', request: {}}])
    expect(output).toEqual(['SMS disabled.'])
  })

  it('disable-dependencies lists what still depends on SMS', async () => {
    const {calls} = await runCommand(SmsDisableDependencies, [])
    expect(calls).toEqual([{method: 'getSmsDisableDependencies', request: {}}])
  })
})

describe('sms settings', () => {
  it('reads the project settings', async () => {
    const {calls} = await runCommand(SmsSettings, [])
    expect(calls).toEqual([{method: 'getSmsSettings', request: {}}])
  })

  it('passes an explicit settings id', async () => {
    const {calls} = await runCommand(SmsSettings, ['--id', ID])
    expect(calls[0]?.request).toEqual({id: ID})
  })
})

describe('sms preview', () => {
  it('sends the preview hash', async () => {
    const {calls} = await runCommand(SmsPreview, ['8f2a91c4'])
    expect(calls).toEqual([{method: 'previewSmsNotification', request: {hash: '8f2a91c4'}}])
  })

  it('takes the hash from --hash too', async () => {
    const {calls} = await runCommand(SmsPreview, ['--hash', 'abc.def'])
    expect(calls).toEqual([{method: 'previewSmsNotification', request: {hash: 'abc.def'}}])
  })

  it('refuses to run with no hash at all', async () => {
    await expect(runCommand(SmsPreview, [])).rejects.toThrow(/preview hash/)
  })
})

/**
 * The signed preview link opens without sign-in: the hash is the key. These run
 * the real command through oclif and the real `@norbix.ai/ts` transport, with
 * `fetch` replaced — nothing leaves the process. The test HOME is empty (see
 * test/setup.ts), so there is no login session and no profile.
 */
describe('sms preview — signed link, no login, no project', () => {
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
      return new Response(JSON.stringify({body: 'Hi Ada, your code is 4242'}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      })
    }) as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('does not ask for a project, and sends no project header', async () => {
    const {error} = await runOclif(['sms', 'preview', '--hash', 'abc.def', '--api-key', 'k-1', '--region', 'nb-eu-germany'])

    expect(error).toBeUndefined()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.url.pathname).toBe('/v2/notifications/sms/preview')
    expect(sent[0]!.url.searchParams.get('hash')).toBe('abc.def')
    expect(sent[0]!.headers.get('norbix-project-id')).toBeNull()
    expect(sent[0]!.headers.get('X-CM-ProjectId')).toBeNull()
  })

  it('still uses a login when there is one', async () => {
    const {error} = await runOclif([
      'sms', 'preview', 'abc.def', '--api-key', 'k-1', '--project', 'p-1', '--region', 'nb-eu-germany',
    ])

    expect(error).toBeUndefined()
    expect(sent[0]!.headers.get('Authorization')).toBe('Bearer k-1')
    expect(sent[0]!.headers.get('norbix-project-id')).toBe('p-1')
  })

  it('sends the request with no Authorization header when there is no login', async () => {
    // @norbix.ai/ts 4.2.0 scopes the preview method 'optional': the SDK does
    // not refuse, and nothing is signed — the link's hash is the key.
    const {error} = await runOclif(['sms', 'preview', '--hash', 'abc.def', '--region', 'nb-eu-germany'])

    expect(error).toBeUndefined()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.headers.get('Authorization')).toBeNull()
  })
})

describe('sms integrations', () => {
  it('lists with no paging by default', async () => {
    const {calls} = await runCommand(SmsIntegrations, [])
    expect(calls[0]?.method).toBe('getSmsIntegrations')
    expect(calls[0]?.request).toEqual({pageSize: undefined, startingAfter: undefined})
  })

  it('passes page size and cursor', async () => {
    const {calls} = await runCommand(SmsIntegrations, ['--page-size', '50', '--after', 'cur_1'])
    expect(calls[0]?.request).toEqual({pageSize: 50, startingAfter: 'cur_1'})
  })

  it('shows one integration', async () => {
    const {calls} = await runCommand(SmsIntegration, [ID])
    expect(calls).toEqual([{method: 'getSmsIntegration', request: {id: ID}}])
  })
})

describe('sms integration state changes', () => {
  const cases = [
    {command: SmsIntegrationEnable, method: 'enableSmsIntegration', argv: [ID], output: `Integration ${ID} enabled.`},
    {command: SmsIntegrationDisable, method: 'disableSmsIntegration', argv: [ID], output: `Integration ${ID} disabled.`},
    {command: SmsIntegrationDefault, method: 'setSmsIntegrationAsDefault', argv: [ID], output: `Integration ${ID} is now the default.`},
    {command: SmsIntegrationDelete, method: 'deleteSmsIntegration', argv: [ID, '--yes'], output: `Integration ${ID} deleted.`},
  ]

  for (const {command, method, argv, output} of cases) {
    it(`${method} sends the integration id and says what it did`, async () => {
      const result = await runCommand(command, argv)
      expect(result.calls).toEqual([{method, request: {id: ID}}])
      expect(result.output).toEqual([output])
    })
  }
})

describe('sms integration test', () => {
  it('sends a test SMS through the chosen integration to a phone number', async () => {
    const {calls} = await runCommand(SmsIntegrationTest, ['--integration', ID, '--to', '+37060000000'])
    expect(calls).toEqual([{method: 'testSmsIntegration', request: {integrationId: ID, to: '+37060000000'}}])
  })

  it('lets the server pick the number when --to is left out', async () => {
    const {calls} = await runCommand(SmsIntegrationTest, ['--integration', ID])
    expect(calls).toEqual([{method: 'testSmsIntegration', request: {integrationId: ID, to: undefined}}])
  })

  it('requires an integration id', async () => {
    await expect(runCommand(SmsIntegrationTest, ['--to', '+37060000000'])).rejects.toThrow()
  })
})

describe('sms integration confirm-delivery', () => {
  it('confirms a human saw the test SMS', async () => {
    const {calls, output} = await runCommand(SmsIntegrationConfirmDelivery, [ID])
    expect(calls).toEqual([{method: 'confirmSmsIntegrationHumanDelivery', request: {integrationId: ID}}])
    expect(output).toEqual([`Delivery confirmed for integration ${ID}.`])
  })
})

describe('sms template tokens and render', () => {
  it('lists the tokens of a template', async () => {
    const {calls} = await runCommand(SmsTemplateTokens, [ID])
    expect(calls).toEqual([{method: 'getSmsMessageContentTokens', request: {id: ID}}])
  })

  it('renders Razor text with Custom token values', async () => {
    const {calls} = await runCommand(SmsTemplateRender, ['--code', 'Hi @Model.Name', '--token', 'Name=Ada', '--preview'])
    expect(calls).toEqual([
      {
        method: 'renderSms',
        request: {code: 'Hi @Model.Name', tokens: [{key: 'Name', value: 'Ada', resolver: 'Custom'}], isForPreview: true},
      },
    ])
  })

  it('refuses a token that is not key=value', async () => {
    await expect(runCommand(SmsTemplateRender, ['--code', 'x', '--token', 'Name'])).rejects.toThrow(/key=value/)
  })
})

describe('sms campaign reads and delete', () => {
  it('batches pass the campaign id and paging', async () => {
    const {calls} = await runCommand(SmsCampaignBatches, [ID, '--page-size', '10', '--after', 'cur_1'])
    expect(calls).toEqual([{method: 'getSmsCampaignBatches', request: {id: ID, pageSize: 10, startingAfter: 'cur_1'}}])
  })

  it('batch lists the notifications of one batch', async () => {
    const {calls} = await runCommand(SmsCampaignBatch, [ID, BATCH])
    expect(calls).toEqual([
      {method: 'getSmsCampaignBatchNotifications', request: {id: ID, batchId: BATCH, pageSize: undefined, startingAfter: undefined}},
    ])
  })

  it('batch with a notification id shows just that notification', async () => {
    const {calls} = await runCommand(SmsCampaignBatch, [ID, BATCH, MESSAGE])
    expect(calls).toEqual([{method: 'getSmsCampaignBatchNotification', request: {id: ID, batchId: BATCH, notificationId: MESSAGE}}])
  })

  it('messages narrows to a batch and pages', async () => {
    const {calls} = await runCommand(SmsCampaignMessages, [ID, '--batch', BATCH, '--page-size', '5'])
    expect(calls).toEqual([
      {method: 'getSmsCampaignMessages', request: {campaignId: ID, campaignBatchId: BATCH, pageSize: 5, startingAfter: undefined}},
    ])
  })

  it('message names the fields the way the route does: campaignId + notificationId', async () => {
    const {calls} = await runCommand(SmsCampaignMessage, [ID, MESSAGE, '--batch', BATCH])
    expect(calls).toEqual([{method: 'getSmsCampaignMessage', request: {campaignId: ID, notificationId: MESSAGE, campaignBatchId: BATCH}}])
  })

  it('message requires the batch', async () => {
    await expect(runCommand(SmsCampaignMessage, [ID, MESSAGE])).rejects.toThrow()
  })

  it('delete --yes deletes the campaign', async () => {
    const {calls, output} = await runCommand(SmsCampaignDelete, [ID, '--yes'])
    expect(calls).toEqual([{method: 'deleteSmsCampaign', request: {id: ID}}])
    expect(output).toEqual([`Campaign ${ID} deleted.`])
  })
})

it('every push command has an sms twin, except the device commands (SMS has no devices)', async () => {
  const config = await Config.load(fileURLToPath(new URL('..', import.meta.url)))
  const push = config.commandIDs.filter((id) => id.startsWith('push:') && !id.startsWith('push:device'))
  const missing = push.map((id) => id.replace(/^push:/, 'sms:')).filter((id) => !config.findCommand(id))
  expect(push.length).toBeGreaterThan(20)
  expect(missing).toEqual([])
})
