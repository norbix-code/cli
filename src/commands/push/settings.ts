import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushSettings extends BaseCommand {
  static description = 'Show the project push settings'

  static examples = ['<%= config.bin %> push settings']

  static flags = {
    id: Flags.string({description: 'Settings ID (defaults to the project settings)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushSettings)
    const client = this.client(flags)

    const res = await client.hub.notifications.getPushSettings(flags.id ? {id: flags.id} : {})

    this.print(res)
    return res
  }
}
