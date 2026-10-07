import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class DbGet extends BaseCommand {
  static description = 'Get one record by ID'

  static examples = [
    '<%= config.bin %> db get orders 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> db get articles 66b2f0a1c3d4e5f6a7b8c9d0 --expand',
  ]

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
    id: Args.string({required: true, description: 'Record ID'}),
  }

  static flags = {
    expand: Flags.boolean({
      description: 'Read every reference field (user, role, term, record, file) as {id, display} instead of the bare id',
      default: false,
    }),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbGet)
    const client = this.client(flags)

    const res = await client.api.database.findOne({
      collectionName: args.collection,
      id: args.id,
      expandReferences: flags.expand,
    })

    this.print(res)
    return res
  }
}
