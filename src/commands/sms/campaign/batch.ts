import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class SmsCampaignBatch extends BaseCommand {
  static description = `List the notifications in one batch — or show one of them

Give a notification ID as the third argument to see just that notification.`

  static examples = [
    '<%= config.bin %> sms campaign batch 66b2f0a1... b7c3...',
    '<%= config.bin %> sms campaign batch 66b2f0a1... b7c3... n9d4...',
  ]

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
    batchId: Args.string({required: true, description: 'Batch ID (from `sms campaign batches`)'}),
    notificationId: Args.string({description: 'Notification ID'}),
  }

  static flags = {
    'page-size': Flags.integer({description: 'Items per page'}),
    after: Flags.string({description: 'Cursor from the previous page'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsCampaignBatch)
    const client = this.client(flags)
    const n = client.hub.notifications

    const res = args.notificationId
      ? await n.getSmsCampaignBatchNotification({
          id: args.id,
          batchId: args.batchId,
          notificationId: args.notificationId,
        })
      : await n.getSmsCampaignBatchNotifications({
          id: args.id,
          batchId: args.batchId,
          pageSize: flags['page-size'],
          startingAfter: flags.after,
        })

    this.print(res)
    return res
  }
}
