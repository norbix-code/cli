import {describe, expect, it} from 'vitest'

import SmsArchive from '../src/commands/sms/archive.js'
import SmsCampaign from '../src/commands/sms/campaign.js'
import SmsCampaigns from '../src/commands/sms/campaigns.js'
import SmsClone from '../src/commands/sms/clone.js'
import SmsDelete from '../src/commands/sms/delete.js'
import SmsStop from '../src/commands/sms/stop.js'
import SmsTemplate from '../src/commands/sms/template.js'
import SmsTemplates from '../src/commands/sms/templates.js'
import SmsUnarchive from '../src/commands/sms/unarchive.js'
import {runCommand} from './_helpers.js'

/**
 * Cover the nine sms commands that shipped before this item (the email twins).
 * They had no tests at all. These check which SDK method each one picks and
 * which fields it fills; `sms-routes.test.ts` proves the verb and path through
 * the real transport.
 */

const ID = '66b2f0a1'

describe('sms templates', () => {
  it('lists templates, live only by default', async () => {
    const {calls} = await runCommand(SmsTemplates, [])
    expect(calls).toEqual([{method: 'getSmsTemplates', request: {showArchived: false}}])
  })

  it('includes archived templates with --archived', async () => {
    const {calls} = await runCommand(SmsTemplates, ['--archived'])
    expect(calls[0]?.request).toEqual({showArchived: true})
  })

  it('shows one template', async () => {
    const {calls} = await runCommand(SmsTemplate, [ID])
    expect(calls).toEqual([{method: 'getSmsTemplate', request: {id: ID}}])
  })
})

describe('sms template state changes', () => {
  // These four routes spell their token `{Id}`; the commands send the generated
  // field `id`, which @norbix.ai/ts 4.2.0 matches case-insensitively. The route
  // test proves the resolved path; this one pins the method and the field.
  const cases = [
    {command: SmsArchive, method: 'archiveSmsTemplate', argv: [ID], output: `Template ${ID} archived.`},
    {command: SmsUnarchive, method: 'unArchiveSmsTemplate', argv: [ID], output: `Template ${ID} restored.`},
    {command: SmsClone, method: 'cloneSmsTemplate', argv: [ID], output: `Template ${ID} cloned.`},
    {command: SmsDelete, method: 'deleteSmsTemplate', argv: [ID, '--yes'], output: `Template ${ID} deleted.`},
  ]

  for (const {command, method, argv, output} of cases) {
    it(`${method} sends the template id and says what it did`, async () => {
      const result = await runCommand(command, argv)
      expect(result.calls).toEqual([{method, request: {id: ID}}])
      expect(result.output).toEqual([output])
    })
  }
})

describe('sms campaigns', () => {
  it('lists campaigns', async () => {
    const {calls} = await runCommand(SmsCampaigns, [])
    expect(calls[0]?.method).toBe('getSmsCampaigns')
    expect(calls[0]?.request).toEqual({pageSize: undefined, startingAfter: undefined})
  })

  it('passes page size and cursor', async () => {
    const {calls} = await runCommand(SmsCampaigns, ['--page-size', '10', '--after', 'cur_1'])
    expect(calls[0]?.request).toEqual({pageSize: 10, startingAfter: 'cur_1'})
  })

  it('filters by campaign id, template and campaign time (ISO or Unix seconds → Unix seconds)', async () => {
    const {calls} = await runCommand(SmsCampaigns, [
      '--campaign-id', 'cmp_1', '--template', 'tpl_1', '--from', '2026-10-01T00:00:00Z', '--to', '1793404799',
    ])
    expect(calls).toEqual([
      {
        method: 'getSmsCampaigns',
        request: {pageSize: undefined, startingAfter: undefined, campaignId: 'cmp_1', templateId: 'tpl_1', from: 1790812800, to: 1793404799},
      },
    ])
  })

  it('refuses a --from that is not a date, before any call', async () => {
    await expect(runCommand(SmsCampaigns, ['--from', 'yesterday'])).rejects.toThrow(/--from is not a date/)
  })

  it('shows one campaign', async () => {
    const {calls} = await runCommand(SmsCampaign, [ID])
    expect(calls).toEqual([{method: 'getSmsCampaign', request: {id: ID}}])
  })

  it('shows statistics instead with --stats', async () => {
    const {calls} = await runCommand(SmsCampaign, [ID, '--stats'])
    expect(calls).toEqual([{method: 'getSmsCampaignStatistics', request: {id: ID}}])
  })
})

describe('sms stop', () => {
  it('stops a campaign through the SDK method', async () => {
    // Before this item the command probed for `stopSmsCampaign` and printed a
    // `norbix api` fallback for SDKs older than 1.3.0. The CLI now requires
    // @norbix.ai/ts ^4.2.0, so it calls the method like `push stop` does.
    const {calls, output} = await runCommand(SmsStop, [ID, '--yes'])
    expect(calls).toEqual([{method: 'stopSmsCampaign', request: {id: ID}}])
    expect(output).toEqual([`Campaign ${ID} stopped.`])
  })
})
