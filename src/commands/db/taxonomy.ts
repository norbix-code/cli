import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {TAXONOMY_KEY_DESCRIPTION, dryRunTaxonomyId, taxonomyIdOf} from '../../lib/taxonomy.js'

export default class DbTaxonomy extends BaseCommand {
  static description = 'Show one database taxonomy'

  static examples = ['<%= config.bin %> db taxonomy txn_5BBS25C3IKHRfzVABMjMiM', '<%= config.bin %> db taxonomy allergens']

  static args = {
    id: Args.string({required: true, description: TAXONOMY_KEY_DESCRIPTION}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTaxonomy)
    const client = this.client(flags)

    const id = await this.lookup(flags, dryRunTaxonomyId(args.id), (c) => taxonomyIdOf(c.hub, args.id))
    const res = await client.hub.database.getDatabaseTaxonomy({id})

    this.print(res)
    return res
  }
}
