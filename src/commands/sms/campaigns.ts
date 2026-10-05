import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {toUnixSeconds} from '../../lib/sms.js'

export default class SmsCampaigns extends BaseCommand {
  static description = `List SMS campaigns

Filters (all optional, combine freely): --campaign-id returns just that
campaign, --template only campaigns built on that template, --from / --to bound
the campaign time (ISO 8601 date-time or Unix seconds, UTC).`

  static examples = [
    '<%= config.bin %> sms campaigns',
    '<%= config.bin %> sms campaigns --template 66b2f0a1c3d4e5f6a7b8c9d0 --from 2026-10-01T00:00:00Z --to 2026-10-31T23:59:59Z',
    '<%= config.bin %> sms campaigns --campaign-id 66e1f2a3b4c5d6e7f8a9b0c1',
  ]

  static flags = {
    'campaign-id': Flags.string({description: 'Only the campaign with this ID'}),
    template: Flags.string({description: 'Only campaigns built on this SMS template ID'}),
    from: Flags.string({description: 'Campaign time from: ISO 8601 date-time or Unix seconds (UTC)'}),
    to: Flags.string({description: 'Campaign time to: ISO 8601 date-time or Unix seconds (UTC)'}),
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SmsCampaigns)
    const client = this.client(flags)

    // Filters are only sent when set, so a plain `sms campaigns` sends the
    // same request as before. From / To are Unix seconds on the wire
    // (Hub.Sms/Campaigns/GetAll.cs).
    const res = await client.hub.notifications.getSmsCampaigns({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
      ...(flags['campaign-id'] ? {campaignId: flags['campaign-id']} : {}),
      ...(flags.template ? {templateId: flags.template} : {}),
      ...(flags.from ? {from: toUnixSeconds(flags.from, 'from')} : {}),
      ...(flags.to ? {to: toUnixSeconds(flags.to, 'to')} : {}),
    })

    this.print(res)
    return res
  }
}
