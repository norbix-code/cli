import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PushCampaignMessage extends BaseCommand {
  static description = `Show one push message a campaign sent

Same as \`push campaign batch <id> <batchId> <messageId>\`.`

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

    // The gateway removed `GET /campaigns/{campaignId}/messages/{notificationId}`
    // and @norbix.ai/ts 4.4.0 dropped its method. The same message is read by
    // campaign, batch and notification id from the batch route — exactly what
    // `push campaign batch <id> <batchId> <notificationId>` calls. This
    // command stays so scripts that use it keep working.
    const res = await client.hub.notifications.getPushCampaignBatchNotification({
      id: args.id,
      batchId: flags.batch,
      notificationId: args.messageId,
    })

    this.print(res)
    return res
  }
}
