import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class DbIntegration extends BaseCommand {
  static description = 'Show one database integration'

  static examples = ['<%= config.bin %> db integration 66b2f0a1c3d4e5f6a7b8c9d0']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbIntegration)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseIntegration({id: args.id})

    this.print(res)
    return res
  }
}
