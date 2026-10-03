import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailCampaignBatch extends BaseCommand {
  static description = `List the e-mails in one batch — or show one of them

Give a notification ID as the third argument to see just that e-mail. To see
how it looked, run \`email preview --notification <notificationId>\`.`

  static examples = [
    '<%= config.bin %> email campaign batch 66b2f0a1c3d4e5f6a7b8c9d0 b7c3d2e1f0a9b8c7d6e5f4a3',
    '<%= config.bin %> email campaign batch 66b2f0a1c3d4e5f6a7b8c9d0 b7c3d2e1f0a9b8c7d6e5f4a3 9d4e5f6a7b8c9d0e1f2a3b4c',
  ]

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
    batchId: Args.string({required: true, description: 'Batch ID (from `email campaign batches`)'}),
    notificationId: Args.string({description: 'Notification ID'}),
  }

  static flags = {
    'database-integration': Flags.string({description: 'Database integration ID (defaults to the project default)'}),
    'page-size': Flags.integer({description: 'Items per page'}),
    after: Flags.string({description: 'Cursor from the previous page'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailCampaignBatch)
    const client = this.client(flags)
    const n = client.hub.notifications

    const res = args.notificationId
      ? await n.getEmailCampaignBatchNotification({
          id: args.id,
          batchId: args.batchId,
          notificationId: args.notificationId,
          databaseIntegrationId: flags['database-integration'],
        })
      : await n.getEmailCampaignBatchNotifications({
          id: args.id,
          batchId: args.batchId,
          databaseIntegrationId: flags['database-integration'],
          pageSize: flags['page-size'],
          startingAfter: flags.after,
        })

    this.print(res)
    return res
  }
}
