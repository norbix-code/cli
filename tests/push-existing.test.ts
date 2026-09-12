import {describe, expect, it} from 'vitest'

import PushArchive from '../src/commands/push/archive.js'
import PushCampaign from '../src/commands/push/campaign.js'
import PushCampaigns from '../src/commands/push/campaigns.js'
import PushClone from '../src/commands/push/clone.js'
import PushDelete from '../src/commands/push/delete.js'
import PushStop from '../src/commands/push/stop.js'
import PushTemplate from '../src/commands/push/template.js'
import PushTemplates from '../src/commands/push/templates.js'
import PushUnarchive from '../src/commands/push/unarchive.js'
import {runCommand} from './_helpers.js'

/**
 * Cover the push commands that shipped before this lane. They had no tests at
 * all, and four of them were sending the wrong path-token casing.
 */

const ID = '66b2f0a1'

describe('push templates', () => {
  it('lists templates, live only by default', async () => {
    const {calls} = await runCommand(PushTemplates, [])
    expect(calls).toEqual([{method: 'getPushTemplates', request: {showArchived: false}}])
  })

  it('includes archived templates with --archived', async () => {
    const {calls} = await runCommand(PushTemplates, ['--archived'])
    expect(calls[0]?.request).toEqual({showArchived: true})
  })

  it('shows one template', async () => {
    const {calls} = await runCommand(PushTemplate, [ID])
    expect(calls).toEqual([{method: 'getPushTemplate', request: {id: ID}}])
  })
})

describe('push template state changes', () => {
  // These four routes spell the token `{Id}`; `getPushTemplate` above spells it
  // `{id}`. The transport matches the name exactly, so the casing per command
  // is not cosmetic — it decides whether the call reaches the server at all.
  const cases = [
    {command: PushArchive, method: 'archivePushTemplate', argv: [ID]},
    {command: PushUnarchive, method: 'unArchivePushTemplate', argv: [ID]},
    {command: PushClone, method: 'clonePushTemplate', argv: [ID]},
    {command: PushDelete, method: 'deletePushTemplate', argv: [ID, '--yes']},
  ]

  for (const {command, method, argv} of cases) {
    it(`${method} sends the id as the Id route token`, async () => {
      const {calls} = await runCommand(command, argv)
      expect(calls).toEqual([{method, request: {Id: ID}}])
    })
  }
})

describe('push campaigns', () => {
  it('lists campaigns', async () => {
    const {calls} = await runCommand(PushCampaigns, [])
    expect(calls[0]?.method).toBe('getPushCampaigns')
    expect(calls[0]?.request).toEqual({pageSize: undefined, startingAfter: undefined})
  })

  it('passes page size and cursor', async () => {
    const {calls} = await runCommand(PushCampaigns, ['--page-size', '10', '--after', 'cur_1'])
    expect(calls[0]?.request).toEqual({pageSize: 10, startingAfter: 'cur_1'})
  })

  it('shows one campaign', async () => {
    const {calls} = await runCommand(PushCampaign, [ID])
    expect(calls).toEqual([{method: 'getPushCampaign', request: {id: ID}}])
  })

  it('shows statistics instead with --stats', async () => {
    const {calls} = await runCommand(PushCampaign, [ID, '--stats'])
    expect(calls).toEqual([{method: 'getPushCampaignStatistics', request: {id: ID}}])
  })
})

describe('push stop', () => {
  it('stops a campaign, sending the id as the Id route token', async () => {
    const {calls} = await runCommand(PushStop, [ID, '--yes'])
    expect(calls).toEqual([{method: 'stopPushCampaign', request: {id: ID}}])
  })

  it('explains itself when the installed SDK has no stopPushCampaign', async () => {
    // The published @norbix.ai/ts does not ship this method yet, so the command
    // guards for it. Without the guard the user would see "not a function".
    await expect(
      runCommand(PushStop, [ID, '--yes'], {notifications: {}}),
    ).rejects.toThrow(/does not support stopping campaigns yet/)
  })
})
