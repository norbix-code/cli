import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbSchemaIndexStatus extends BaseCommand {
  static description =
    'Show the last schema-index run of a collection — the indexes Norbix wanted, created, dropped or could not create, per database'

  static examples = ['<%= config.bin %> db schema index-status 66b2f0a1c3d4e5f6a7b8c9d0']

  static args = {
    id: Args.string({required: true, description: 'Schema ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchemaIndexStatus)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseSchemaIndexStatus({id: args.id})

    this.print(res)
    return res
  }
}
