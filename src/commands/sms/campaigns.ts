import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SmsCampaigns extends BaseCommand {
  static description = 'List SMS campaigns'

  static examples = ['<%= config.bin %> sms campaigns']

  static flags = {
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SmsCampaigns)
    const client = this.client(flags)

    const res = await client.hub.notifications.getSmsCampaigns({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
