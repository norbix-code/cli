import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {databaseIntegrationFlag} from '../../lib/database.js'

export default class DbTerm extends BaseCommand {
  static description = 'Show one taxonomy term'

  static examples = ['<%= config.bin %> db term 66b2f0a1c3d4e5f6a7b8c9d0 66b2f0a1c3d4e5f6a7b8c9d1']

  static args = {
    taxonomyId: Args.string({required: true, description: 'Taxonomy ID'}),
    id: Args.string({required: true, description: 'Term ID'}),
  }

  static flags = {
    ...databaseIntegrationFlag,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTerm)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseTaxonomyTerm({
      taxonomyId: args.taxonomyId,
      id: args.id,
      databaseIntegrationId: flags.integration,
    })

    this.print(res)
    return res
  }
}
