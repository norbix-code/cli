import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class SmsCampaignMessage extends BaseCommand {
  static description = 'Show one SMS message a campaign sent'

  static examples = ['<%= config.bin %> sms campaign message 66b2f0a1... n9d4... --batch b7c3...']

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
    messageId: Args.string({required: true, description: 'Message (notification) ID'}),
  }

  static flags = {
    batch: Flags.string({required: true, description: 'Batch the message belongs to'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsCampaignMessage)
    const client = this.client(flags)

    // The route is `/campaigns/{campaignId}/messages/{notificationId}` and the
    // request type names its fields the same way — no extra `id`, no cast.
    const res = await client.hub.notifications.getSmsCampaignMessage({
      campaignId: args.id,
      notificationId: args.messageId,
      campaignBatchId: flags.batch,
    })

    this.print(res)
    return res
  }
}
