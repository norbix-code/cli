import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailCampaignBatches extends BaseCommand {
  static description = 'List the send batches of an email campaign'

  static examples = [
    '<%= config.bin %> email campaign batches 66b2f0a1...',
    '<%= config.bin %> email campaign batches 66b2f0a1... --email ada@example.com',
  ]

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    batch: Flags.string({description: 'Only this batch'}),
    email: Flags.string({description: 'Only batches that went to this address'}),
    'database-integration': Flags.string({description: 'Database integration ID (defaults to the project default)'}),
    'page-size': Flags.integer({description: 'Items per page'}),
    after: Flags.string({description: 'Cursor from the previous page'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailCampaignBatches)
    const client = this.client(flags)

    const res = await client.hub.notifications.getEmailCampaignBatches({
      id: args.id,
      batchId: flags.batch,
      emailAddress: flags.email,
      databaseIntegrationId: flags['database-integration'],
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
