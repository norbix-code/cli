import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {readJsonInput} from '../../lib/json.js'

export default class DbDistinct extends BaseCommand {
  static description = 'List the distinct values of one field in a collection'

  static examples = [`<%= config.bin %> db distinct orders status --filter '{"total":{"$gt":10}}'`]

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
    field: Args.string({required: true, description: 'Field name'}),
  }

  static flags = {
    filter: Flags.string({char: 'f', description: 'JSON filter (or `-` for stdin)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbDistinct)
    const client = this.client(flags)

    const res = await client.api.database.distinct({
      collectionName: args.collection,
      field: args.field,
      filter: flags.filter ? await readJsonInput(flags.filter, 'filter') : undefined,
    })

    this.print(res)
    return res
  }
}
