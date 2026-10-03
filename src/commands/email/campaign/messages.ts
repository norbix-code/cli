import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailCampaignMessages extends BaseCommand {
  static description = 'List the e-mails a campaign sent in one batch'

  static examples = ['<%= config.bin %> email campaign messages 66b2f0a1c3d4e5f6a7b8c9d0 --batch b7c3d2e1f0a9b8c7d6e5f4a3']

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    batch: Flags.string({required: true, description: 'Batch ID (from `email campaign batches`)'}),
    'database-integration': Flags.string({description: 'Database integration ID (defaults to the project default)'}),
    'page-size': Flags.integer({description: 'Items per page'}),
    after: Flags.string({description: 'Cursor from the previous page'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailCampaignMessages)
    const client = this.client(flags)

    // The route is /notifications/emails/... (plural) — the SDK method has it.
    const res = await client.hub.notifications.getEmailCampaignMessages({
      campaignId: args.id,
      campaignBatchId: flags.batch,
      databaseIntegrationId: flags['database-integration'],
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
