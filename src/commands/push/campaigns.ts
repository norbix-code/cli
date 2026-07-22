import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushCampaigns extends BaseCommand {
  static description = 'List push campaigns'

  static examples = ['<%= config.bin %> push campaigns']

  static flags = {
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushCampaigns)
    const client = this.client(flags)

    const res = await client.hub.notifications.getPushCampaigns({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
