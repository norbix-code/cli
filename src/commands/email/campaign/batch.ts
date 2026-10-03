import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailCampaignBatch extends BaseCommand {
  static description = `List the e-mails in one batch — or show one of them

Give a notification ID as the third argument to see just that e-mail. To see
how it looked, run \`email preview --notification <notificationId>\`.`

  static examples = [
    '<%= config.bin %> email campaign batch 66b2f0a1... b7c3...',
    '<%= config.bin %> email campaign batch 66b2f0a1... b7c3... n9d4...',
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
