import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushDevice extends BaseCommand {
  static description = 'Show one registered push device, with the user it belongs to'

  static examples = ['<%= config.bin %> push device pnd_123']

  static args = {
    id: Args.string({required: true, description: 'Device ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushDevice)
    const client = this.client(flags)

    const res = await client.hub.notifications.getPushDevice({id: args.id})

    this.print(res)
    return res
  }
}
