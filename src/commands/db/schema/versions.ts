import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbSchemaVersions extends BaseCommand {
  static description = 'List the published versions of a database schema'

  static examples = ['<%= config.bin %> db schema versions 66b2f0a1c3d4e5f6a7b8c9d0']

  static args = {
    id: Args.string({required: true, description: 'Schema ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchemaVersions)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseSchemaVersions({id: args.id})

    this.print(res)
    return res
  }
}
