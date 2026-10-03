import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailSignatures extends BaseCommand {
  static description = 'List the email signatures'

  static examples = ['<%= config.bin %> email signatures']

  static flags = {
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailSignatures)
    const client = this.client(flags)

    const res = await client.hub.notifications.getEmailSignatures({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
