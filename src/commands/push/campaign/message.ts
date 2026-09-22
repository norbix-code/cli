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

    // The route is `/campaigns/{campaignId}/messages/{id}`, but the request
    // type has no `id` field — the server reads `notificationId`. Send both:
    // `id` fills the path token, `notificationId` is what the server binds.
    const res = await client.hub.notifications.getPushCampaignMessage({
      campaignId: args.id,
      id: args.messageId,
      notificationId: args.messageId,
      campaignBatchId: flags.batch,
    } as unknown as Parameters<typeof client.hub.notifications.getPushCampaignMessage>[0])

    this.print(res)
    return res
  }
}
