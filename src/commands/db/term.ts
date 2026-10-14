import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {databaseIntegrationFlag} from '../../lib/database.js'
import {TAXONOMY_KEY_DESCRIPTION, dryRunTaxonomyId, taxonomyIdOf} from '../../lib/taxonomy.js'

export default class DbTerm extends BaseCommand {
  static description = 'Show one taxonomy term'

  static examples = ['<%= config.bin %> db term countries 66b2f0a1c3d4e5f6a7b8c9d1']

  static args = {
    taxonomyId: Args.string({required: true, description: TAXONOMY_KEY_DESCRIPTION}),
    id: Args.string({required: true, description: 'Term ID'}),
  }

  static flags = {
    ...databaseIntegrationFlag,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTerm)
    const client = this.client(flags)
    const taxonomyId = await this.lookup(flags, dryRunTaxonomyId(args.taxonomyId), (c) => taxonomyIdOf(c.hub, args.taxonomyId))

    const res = await client.hub.database.getDatabaseTaxonomyTerm({
      taxonomyId,
      id: args.id,
      databaseIntegrationId: flags.integration,
    })

    this.print(res)
    return res
  }
}
