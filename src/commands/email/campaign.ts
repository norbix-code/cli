import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {describeStats} from '../../lib/notifications.js'

export default class EmailCampaign extends BaseCommand {
  static description = 'Show one email campaign (or its statistics with --stats)'

  static examples = ['<%= config.bin %> email campaign 66b2f0a1c3d4e5f6a7b8c9d0 --stats']

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    stats: Flags.boolean({description: 'Show delivery statistics instead of the campaign itself', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailCampaign)
    const client = this.client(flags)

    const res = flags.stats
      ? await client.api.notifications.getEmailCampaignStatistics({id: args.id})
      : await client.api.notifications.getEmailCampaign({id: args.id})

    this.print(flags.stats ? describeStats(res) : res)
    return res
  }
}
