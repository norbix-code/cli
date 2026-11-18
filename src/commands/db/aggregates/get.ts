import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbAggregatesGet extends BaseCommand {
  static description = `Show one saved database aggregate

Returns {item}: viewId, displayName, description, schemaViewId, pipeline (the
MongoDB pipeline as a JSON string, with {TokenKey} placeholders) and
joinedCollections. Run it with \`db aggregate <collection> --id <id>\`.`

  static examples = ['<%= config.bin %> db aggregates get agg_1 --schema sch_7lPCzWonEvTQsheGDCaKq']

  static args = {
    id: Args.string({required: true, description: 'Aggregate ID'}),
  }

  static flags = {
    schema: Flags.string({required: true, description: 'Schema ID (sch_…) the aggregate belongs to'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbAggregatesGet)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseAggregate({id: args.id, schemaId: flags.schema})

    this.print(res)
    return res
  }
}
