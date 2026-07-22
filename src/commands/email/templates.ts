import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailTemplates extends BaseCommand {
  static description = 'List email templates'

  static examples = ['<%= config.bin %> email templates --archived']

  static flags = {
    archived: Flags.boolean({description: 'Include archived templates', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailTemplates)
    const client = this.client(flags)

    const res = await client.hub.notifications.getEmailTemplates({
      showArchived: flags.archived,
    })

    this.print(res)
    return res
  }
}
