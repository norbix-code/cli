import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {databaseIntegrationFlag} from '../../lib/database.js'

export default class DbIndexes extends BaseCommand {
  static description = 'List the indexes of a collection'

  static examples = ['<%= config.bin %> db indexes orders']

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
  }

  static flags = {
    ...databaseIntegrationFlag,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbIndexes)
    const client = this.client(flags)

    const res = await client.hub.database.getCollectionIndexes({
      collectionName: args.collection,
      databaseIntegrationId: flags.integration,
    })

    this.print(res)
    return res
  }
}
