import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {readJsonInput} from '../../lib/json.js'

export default class DbCount extends BaseCommand {
  static description = 'Count records in a collection'

  static examples = [
    '<%= config.bin %> db count orders',
    `<%= config.bin %> db count orders --filter '{"status":"paid"}'`,
  ]

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
  }

  static flags = {
    filter: Flags.string({char: 'f', description: 'JSON filter (or `-` for stdin)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbCount)
    const client = this.client(flags)

    const res = await client.api.database.count({
      collectionName: args.collection,
      filter: flags.filter ? await readJsonInput(flags.filter, 'filter') : undefined,
    })

    this.print(res)
    return res
  }
}
