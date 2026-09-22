import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PushCampaignMessages extends BaseCommand {
  static description = 'List the push messages a campaign sent'

  static examples = ['<%= config.bin %> push campaign messages 66b2f0a1... --batch b7c3...']

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    batch: Flags.string({description: 'Only this batch (from `push campaign batches`)'}),
    'page-size': Flags.integer({description: 'Items per page'}),
    after: Flags.string({description: 'Cursor from the previous page'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushCampaignMessages)
    const client = this.client(flags)

    const res = await client.hub.notifications.getPushCampaignMessages({
      campaignId: args.id,
      campaignBatchId: flags.batch,
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    } as unknown as Parameters<typeof client.hub.notifications.getPushCampaignMessages>[0])

    this.print(res)
    return res
  }
}
