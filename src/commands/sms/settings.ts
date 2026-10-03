import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SmsSettings extends BaseCommand {
  static description = 'Show the project SMS settings'

  static examples = ['<%= config.bin %> sms settings']

  static flags = {
    id: Flags.string({description: 'Settings ID (defaults to the project settings)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SmsSettings)
    const client = this.client(flags)

    const res = await client.hub.notifications.getSmsSettings(flags.id ? {id: flags.id} : {})

    this.print(res)
    return res
  }
}
