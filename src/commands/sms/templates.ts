import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SmsTemplates extends BaseCommand {
  static description = 'List SMS templates'

  static examples = ['<%= config.bin %> sms templates --archived']

  static flags = {
    archived: Flags.boolean({description: 'Include archived templates', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SmsTemplates)
    const client = this.client(flags)

    const res = await client.hub.notifications.getSmsTemplates({
      showArchived: flags.archived,
    })

    this.print(res)
    return res
  }
}
