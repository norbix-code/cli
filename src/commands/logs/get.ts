import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class LogsGet extends BaseCommand {
  static description = 'Show one log entry by its id (the id of a `logs list` row)'

  static examples = ['<%= config.bin %> logs get 66b2f0a1c3d4e5f6a7b8c9d0', '<%= config.bin %> logs get 66b2f0a1c3d4e5f6a7b8c9d0 --json']

  static args = {
    id: Args.string({required: true, description: 'Log entry ID (24 hex characters)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(LogsGet)
    const client = this.client(flags)

    const res = await client.hub.logs.getLog({id: args.id})

    this.print(res)
    return res
  }
}
