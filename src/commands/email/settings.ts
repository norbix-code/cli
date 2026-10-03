import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailSettings extends BaseCommand {
  static description = 'Show the project email settings'

  static examples = ['<%= config.bin %> email settings']

  static flags = {
    id: Flags.string({description: 'Settings ID (defaults to the project settings)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailSettings)
    const client = this.client(flags)

    const res = await client.hub.notifications.getEmailSettings(flags.id ? {id: flags.id} : {})

    this.print(res)
    return res
  }
}
