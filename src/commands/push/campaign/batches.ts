import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PushCampaignBatches extends BaseCommand {
  static description = 'List the send batches of a push campaign'

  static examples = ['<%= config.bin %> push campaign batches 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    'page-size': Flags.integer({description: 'Items per page'}),
    after: Flags.string({description: 'Cursor from the previous page'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushCampaignBatches)
    const client = this.client(flags)

    const res = await client.hub.notifications.getPushCampaignBatches({
      id: args.id,
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    } as unknown as Parameters<typeof client.hub.notifications.getPushCampaignBatches>[0])

    this.print(res)
    return res
  }
}
