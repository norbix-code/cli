import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PushCampaignMessage extends BaseCommand {
  static description = 'Show one push message a campaign sent'

  static examples = ['<%= config.bin %> push campaign message 66b2f0a1... n9d4... --batch b7c3...']

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
    messageId: Args.string({required: true, description: 'Message (notification) ID'}),
  }

  static flags = {
    batch: Flags.string({required: true, description: 'Batch the message belongs to'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushCampaignMessage)
    const client = this.client(flags)

    // The gateway route now names its token `{notificationId}`, and the
    // regenerated request type has the matching field — so the workaround
    // this command used to carry (an extra `id` plus a cast, because the
    // token and the field had different names) is gone.
    const res = await client.hub.notifications.getPushCampaignMessage({
      campaignId: args.id,
      notificationId: args.messageId,
      campaignBatchId: flags.batch,
    })

    this.print(res)
    return res
  }
}
