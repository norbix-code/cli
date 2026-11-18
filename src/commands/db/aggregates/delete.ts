import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbAggregatesDelete extends BaseCommand {
  static description = `Delete a saved database aggregate

Code that runs it by id (\`db aggregate <collection> --id\`, the SDK's
executeRecordsAggregate) stops working. A schema with saved aggregates cannot
be deleted until they are gone.`

  static examples = [
    '<%= config.bin %> db aggregates delete agg_1 --schema sch_7lPCzWonEvTQsheGDCaKq --yes',
    '<%= config.bin %> db aggregates delete agg_1 --schema sch_7lPCzWonEvTQsheGDCaKq --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Aggregate ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
    schema: Flags.string({required: true, description: 'Schema ID (sch_…) the aggregate belongs to'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbAggregatesDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete saved aggregate ${args.id}?`, flags)

    const res = await client.hub.database.deleteDatabaseAggregate({id: args.id, schemaId: flags.schema})

    this.print(`Aggregate ${args.id} deleted.`)
    return res
  }
}
