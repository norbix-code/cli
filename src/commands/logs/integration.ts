import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class LogsIntegration extends BaseCommand {
  static description = 'Show one logs integration'

  static examples = ['<%= config.bin %> logs integration 66b2f0a1c3d4e5f6a7b8c9d0']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(LogsIntegration)
    const client = this.client(flags)

    const res = await client.hub.logs.getLoggingIntegration({id: args.id})

    this.print(res)
    return res
  }
}
