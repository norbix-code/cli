import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {databaseIntegrationFlag, readJsonObject, readJsonText} from '../../../lib/database.js'

export default class DbAggregatesTest extends BaseCommand {
  static description = `Try an aggregation pipeline before saving it

Runs the pipeline against the collection and returns the result; nothing is
saved. {TokenKey} placeholders are filled from --tokens. It needs what saving
one needs: create or update permission on the schema's aggregates, and read
access to every collection the pipeline joins. Write stages are refused.
Save it with \`db aggregates save\`.`

  static examples = [
    '<%= config.bin %> db aggregates test orders --pipeline \'[{"$match":{"status":"{Status}"}},{"$count":"n"}]\' --tokens \'{"Status":"paid"}\'',
    '<%= config.bin %> db aggregates test orders --pipeline @totals.json',
  ]

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
  }

  static flags = {
    ...databaseIntegrationFlag,
    pipeline: Flags.string({required: true, description: 'MongoDB pipeline: a JSON array, @file or -'}),
    tokens: Flags.string({description: 'JSON object of {TokenKey} values (inline or @file)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbAggregatesTest)
    const client = this.client(flags)

    const tokens = flags.tokens ? ((await readJsonObject(flags.tokens, 'tokens')) as Record<string, string>) : undefined
    const res = await client.hub.database.testDatabaseAggregate({
      collectionName: args.collection,
      pipeline: await readJsonText(flags.pipeline, 'pipeline'),
      tokens,
      databaseIntegrationId: flags.integration,
    })

    this.print(res)
    return res
  }
}
