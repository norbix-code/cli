import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {formatCampaignStats} from '../../lib/campaigns.js'

export default class PushCampaign extends BaseCommand {
  static description = 'Show one push campaign (or its statistics with --stats)'

  static examples = ['<%= config.bin %> push campaign 66b2f0a1c3d4e5f6a7b8c9d0 --stats']

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    stats: Flags.boolean({description: 'Show delivery statistics instead of the campaign itself', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushCampaign)
    const client = this.client(flags)

    const res = flags.stats
      ? await client.api.notifications.getPushCampaignStatistics({id: args.id})
      : await client.api.notifications.getPushCampaign({id: args.id})

    this.print(flags.stats ? formatCampaignStats(res) : res)
    return res
  }
}
