import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushTemplates extends BaseCommand {
  static description = 'List push notification templates'

  static examples = ['<%= config.bin %> push templates --archived']

  static flags = {
    archived: Flags.boolean({description: 'Include archived templates', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushTemplates)
    const client = this.client(flags)

    const res = await client.hub.notifications.getPushTemplates({
      showArchived: flags.archived,
    })

    this.print(res)
    return res
  }
}
