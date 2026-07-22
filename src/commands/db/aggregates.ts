import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class DbAggregates extends BaseCommand {
  static description = 'List saved database aggregates'

  static examples = ['<%= config.bin %> db aggregates', '<%= config.bin %> db aggregates --schema 66b2...']

  static flags = {
    schema: Flags.string({description: 'Only aggregates of this schema ID'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(DbAggregates)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseAggregates({schemaId: flags.schema})
    this.print(res)
    return res
  }
}
