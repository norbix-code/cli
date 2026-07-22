import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {readJsonInput} from '../../lib/json.js'

export default class DbFind extends BaseCommand {
  static description = 'Find records in a collection (MongoDB-style filter)'

  static examples = [
    '<%= config.bin %> db find orders',
    `<%= config.bin %> db find orders --filter '{"status":"paid"}' --page-size 20`,
    `<%= config.bin %> db find orders --json | jq '.list.items'`,
  ]

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
  }

  static flags = {
    filter: Flags.string({char: 'f', description: 'JSON filter (or `-` for stdin)'}),
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
    before: Flags.string({description: 'Cursor: fetch the page before this item'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbFind)
    const client = this.client(flags)

    const res = await client.api.database.find({
      collectionName: args.collection,
      filter: flags.filter ? await readJsonInput(flags.filter, 'filter') : undefined,
      pageSize: flags['page-size'],
      startingAfter: flags.after,
      endingBefore: flags.before,
    })

    this.print(res)
    return res
  }
}
