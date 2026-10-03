import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailFooters extends BaseCommand {
  static description = 'List the email footers'

  static examples = ['<%= config.bin %> email footers']

  static flags = {
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailFooters)
    const client = this.client(flags)

    const res = await client.hub.notifications.getEmailFooters({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
