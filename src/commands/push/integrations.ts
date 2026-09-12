import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushIntegrations extends BaseCommand {
  static description = 'List the push integrations set up for this project'

  static examples = ['<%= config.bin %> push integrations --page-size 50']

  static flags = {
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushIntegrations)
    const client = this.client(flags)

    const res = await client.hub.notifications.getPushIntegrations({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
