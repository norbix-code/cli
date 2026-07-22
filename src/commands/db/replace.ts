import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {readJsonInput} from '../../lib/json.js'

export default class DbReplace extends BaseCommand {
  static description = 'Replace one record fully (unlike update, the whole document is swapped)'

  static examples = [`<%= config.bin %> db replace orders --id 66b2f0a1... --doc '{"status":"new"}'`]

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
  }

  static flags = {
    id: Flags.string({required: true, description: 'Record ID'}),
    doc: Flags.string({char: 'd', required: true, description: 'JSON replacement document (or `-` for stdin)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbReplace)
    const client = this.client(flags)

    const res = await client.api.database.replaceOne({
      collectionName: args.collection,
      id: flags.id,
      replacement: await readJsonInput(flags.doc, 'doc'),
    })

    this.print(res)
    return res
  }
}
