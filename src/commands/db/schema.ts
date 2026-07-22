import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class DbSchema extends BaseCommand {
  static description = 'Show one database schema'

  static examples = ['<%= config.bin %> db schema 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Schema ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchema)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseSchema({id: args.id})

    this.print(res)
    return res
  }
}
