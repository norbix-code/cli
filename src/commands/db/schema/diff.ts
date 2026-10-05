import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbSchemaDiff extends BaseCommand {
  static description = 'Show what changed between two versions of a database schema'

  static examples = ['<%= config.bin %> db schema diff 66b2f0a1c3d4e5f6a7b8c9d0 --from 1 --to 2']

  static args = {
    id: Args.string({required: true, description: 'Schema ID'}),
  }

  static flags = {
    from: Flags.integer({required: true, description: 'Older version number'}),
    to: Flags.integer({required: true, description: 'Newer version number'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchemaDiff)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseSchemaVersionDiff({
      id: args.id,
      fromVersion: flags.from,
      toVersion: flags.to,
    })

    this.print(res)
    return res
  }
}
