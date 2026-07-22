import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class LogsTrail extends BaseCommand {
  static description = 'Show the full request trail for one correlation ID'

  static examples = ['<%= config.bin %> logs trail 8f2c1b...']

  static args = {
    correlationId: Args.string({required: true, description: 'Correlation ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(LogsTrail)
    const client = this.client(flags)

    const res = await client.hub.logs.getLogsByCorrelationId({
      targetCorrelationId: args.correlationId,
    })

    this.print(res)
    return res
  }
}
