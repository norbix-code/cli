import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {readJsonInput} from '../../lib/json.js'

export default class DbAggregate extends BaseCommand {
  static description = 'Run an aggregation: an inline pipeline, or a saved aggregate by ID'

  static examples = [
    `<%= config.bin %> db aggregate orders --pipeline '[{"$group":{"_id":"$status","n":{"$sum":1}}}]'`,
    '<%= config.bin %> db aggregate orders --id 66b2f0a1...',
  ]

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
  }

  static flags = {
    pipeline: Flags.string({description: 'JSON aggregation pipeline (or `-` for stdin)', exclusive: ['id']}),
    id: Flags.string({description: 'Saved aggregate ID (runs executeAggregate)'}),
    tokens: Flags.string({description: 'JSON object of tokens for a saved aggregate', dependsOn: ['id']}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbAggregate)
    const client = this.client(flags)

    if (flags.id) {
      const tokens = flags.tokens
        ? (JSON.parse(await readJsonInput(flags.tokens, 'tokens')) as Record<string, string>)
        : undefined
      const res = await client.api.database.executeAggregate({
        collectionName: args.collection,
        aggregateId: flags.id,
        tokens,
      })
      this.print(res)
      return res
    }

    if (!flags.pipeline) this.error('Pass --pipeline with inline JSON, or --id for a saved aggregate.')
    const res = await client.api.database.aggregate({
      collectionName: args.collection,
      pipeline: await readJsonInput(flags.pipeline, 'pipeline'),
    })
    this.print(res)
    return res
  }
}
