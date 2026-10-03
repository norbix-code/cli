import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class SmsCampaignMessages extends BaseCommand {
  static description = 'List the SMS messages a campaign sent'

  static examples = ['<%= config.bin %> sms campaign messages 66b2f0a1... --batch b7c3...']

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    batch: Flags.string({description: 'Only this batch (from `sms campaign batches`)'}),
    'page-size': Flags.integer({description: 'Items per page'}),
    after: Flags.string({description: 'Cursor from the previous page'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsCampaignMessages)
    const client = this.client(flags)

    const res = await client.hub.notifications.getSmsCampaignMessages({
      campaignId: args.id,
      campaignBatchId: flags.batch,
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
