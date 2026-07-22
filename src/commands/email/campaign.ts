import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailCampaign extends BaseCommand {
  static description = 'Show one email campaign (or its statistics with --stats)'

  static examples = ['<%= config.bin %> email campaign 66b2f0a1... --stats']

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
      ? await client.hub.notifications.getEmailCampaignStatistics({id: args.id})
      : await client.hub.notifications.getEmailCampaign({id: args.id})

    this.print(res)
    return res
  }
}
