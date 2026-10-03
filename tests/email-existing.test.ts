import {describe, expect, it} from 'vitest'

import EmailArchive from '../src/commands/email/archive.js'
import EmailCampaign from '../src/commands/email/campaign.js'
import EmailCampaigns from '../src/commands/email/campaigns.js'
import EmailClone from '../src/commands/email/clone.js'
import EmailDelete from '../src/commands/email/delete.js'
import EmailStop from '../src/commands/email/stop.js'
import EmailTemplate from '../src/commands/email/template.js'
import EmailTemplates from '../src/commands/email/templates.js'
import EmailUnarchive from '../src/commands/email/unarchive.js'
import {runCommand} from './_helpers.js'

/**
 * Cover the nine email commands that shipped before this item. They had no
 * tests at all. These check which SDK method each one picks and which fields
 * it fills; `email-routes.test.ts` proves the verb and path through the real
 * transport.
 */

const ID = '66b2f0a1'

describe('email templates', () => {
  it('lists templates, live only by default', async () => {
    const {calls} = await runCommand(EmailTemplates, [])
    expect(calls).toEqual([{method: 'getEmailTemplates', request: {showArchived: false}}])
  })

  it('includes archived templates with --archived', async () => {
    const {calls} = await runCommand(EmailTemplates, ['--archived'])
    expect(calls[0]?.request).toEqual({showArchived: true})
  })

  it('shows one template', async () => {
    const {calls} = await runCommand(EmailTemplate, [ID])
    expect(calls).toEqual([{method: 'getEmailTemplate', request: {id: ID}}])
  })
})

describe('email template state changes', () => {
  // These four routes spell their token `{Id}`; the commands send the generated
  // field `id`, which @norbix.ai/ts matches case-insensitively. The route test
  // proves the resolved path; this one pins the method and the field.
  const cases = [
    {command: EmailArchive, method: 'archiveEmailTemplate', argv: [ID], output: `Template ${ID} archived.`},
    {command: EmailUnarchive, method: 'unArchiveEmailTemplate', argv: [ID], output: `Template ${ID} restored.`},
    {command: EmailClone, method: 'cloneEmailTemplate', argv: [ID], output: `Template ${ID} cloned.`},
    {command: EmailDelete, method: 'deleteEmailTemplate', argv: [ID, '--yes'], output: `Template ${ID} deleted.`},
  ]

  for (const {command, method, argv, output} of cases) {
    it(`${method} sends the template id and says what it did`, async () => {
      const result = await runCommand(command, argv)
      expect(result.calls).toEqual([{method, request: {id: ID}}])
      expect(result.output).toEqual([output])
    })
  }
})

describe('email campaigns', () => {
  it('lists campaigns', async () => {
    const {calls} = await runCommand(EmailCampaigns, [])
    expect(calls).toEqual([{method: 'getEmailCampaigns', request: {pageSize: undefined, startingAfter: undefined}}])
  })

  it('passes page size and cursor', async () => {
    const {calls} = await runCommand(EmailCampaigns, ['--page-size', '10', '--after', 'cur_1'])
    expect(calls[0]?.request).toEqual({pageSize: 10, startingAfter: 'cur_1'})
  })

  it('shows one campaign', async () => {
    const {calls} = await runCommand(EmailCampaign, [ID])
    expect(calls).toEqual([{method: 'getEmailCampaign', request: {id: ID}}])
  })

  it('shows statistics instead with --stats', async () => {
    const {calls} = await runCommand(EmailCampaign, [ID, '--stats'])
    expect(calls).toEqual([{method: 'getEmailCampaignStatistics', request: {id: ID}}])
  })
})

describe('email stop', () => {
  it('stops a campaign through the SDK method', async () => {
    const {calls, output} = await runCommand(EmailStop, [ID, '--yes'])
    expect(calls).toEqual([{method: 'stopEmailCampaign', request: {id: ID}}])
    expect(output).toEqual([`Campaign ${ID} stopped.`])
  })

  it('no longer prints the `norbix api` fallback when the SDK lacks the method', async () => {
    // Before this item the command probed for `stopEmailCampaign` and told the
    // user to run `norbix api "<path>" --hub --method POST` — `api` takes
    // plain words, not a path. The CLI requires @norbix.ai/ts ^4.4.0, so the
    // method is always there; with it missing the call simply fails.
    await expect(runCommand(EmailStop, [ID, '--yes'], {notifications: {}})).rejects.toThrow(
      /stopEmailCampaign is not a function/,
    )
  })
})
