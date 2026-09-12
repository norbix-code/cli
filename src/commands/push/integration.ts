import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushIntegration extends BaseCommand {
  static description = 'Show one push integration'

  static examples = ['<%= config.bin %> push integration 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushIntegration)
    const client = this.client(flags)

    const res = await client.hub.notifications.getPushIntegration({id: args.id})

    this.print(res)
    return res
  }
}
