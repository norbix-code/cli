import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailIntegrations extends BaseCommand {
  static description = 'List the email integrations set up for this project'

  static examples = ['<%= config.bin %> email integrations --page-size 50']

  static flags = {
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailIntegrations)
    const client = this.client(flags)

    const res = await client.hub.notifications.getEmailIntegrations({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
