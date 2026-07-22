import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushCampaign extends BaseCommand {
  static description = 'Show one push campaign (or its statistics with --stats)'

  static examples = ['<%= config.bin %> push campaign 66b2f0a1... --stats']

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
      ? await client.hub.notifications.getPushCampaignStatistics({id: args.id})
      : await client.hub.notifications.getPushCampaign({id: args.id})

    this.print(res)
    return res
  }
}
