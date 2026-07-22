import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class DbGet extends BaseCommand {
  static description = 'Get one record by ID'

  static examples = ['<%= config.bin %> db get orders 66b2f0a1...']

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
    id: Args.string({required: true, description: 'Record ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbGet)
    const client = this.client(flags)

    const res = await client.api.database.findOne({
      collectionName: args.collection,
      id: args.id,
    })

    this.print(res)
    return res
  }
}
