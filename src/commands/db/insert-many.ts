import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {readJsonInput} from '../../lib/json.js'

export default class DbInsertMany extends BaseCommand {
  static description = 'Insert many records at once (JSON array)'

  static examples = [
    `<%= config.bin %> db insert-many orders --docs '[{"a":1},{"a":2}]'`,
    'cat orders.json | <%= config.bin %> db insert-many orders --docs -',
  ]

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
  }

  static flags = {
    docs: Flags.string({char: 'd', required: true, description: 'JSON array of documents (or `-` for stdin)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbInsertMany)
    const client = this.client(flags)

    const documents = await readJsonInput(flags.docs, 'docs')
    if (!documents.trimStart().startsWith('[')) this.error('--docs must be a JSON array.')

    const res = await client.api.database.insertMany({
      collectionName: args.collection,
      documents,
    })

    this.print(res)
    return res
  }
}
