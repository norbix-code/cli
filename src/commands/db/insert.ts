import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {readJsonInput} from '../../lib/json.js'

export default class DbInsert extends BaseCommand {
  static description = 'Insert one record into a collection'

  static examples = [
    `<%= config.bin %> db insert orders --doc '{"status":"new","total":9.99}'`,
    'cat order.json | <%= config.bin %> db insert orders --doc -',
  ]

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
  }

  static flags = {
    doc: Flags.string({char: 'd', required: true, description: 'JSON document (or `-` for stdin)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbInsert)
    const client = this.client(flags)

    const res = await client.api.database.insertOne({
      collectionName: args.collection,
      document: await readJsonInput(flags.doc, 'doc'),
    })

    this.print(res)
    return res
  }
}
