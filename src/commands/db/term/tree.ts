import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {databaseIntegrationFlag} from '../../../lib/database.js'

export default class DbTermTree extends BaseCommand {
  static description = `Show the terms of a taxonomy as a tree

--merged also folds in the terms of the parent taxonomies (one tree across
the taxonomy chain).`

  static examples = [
    '<%= config.bin %> db term tree countries',
    '<%= config.bin %> db term tree countries --root 66b2f0a1c3d4e5f6a7b8c9d0 --depth 2',
    '<%= config.bin %> db term tree cities --merged',
  ]

  static args = {
    taxonomy: Args.string({required: true, description: 'Taxonomy name'}),
  }

  static flags = {
    ...databaseIntegrationFlag,
    root: Flags.string({description: 'Start the tree at this term ID', exclusive: ['merged']}),
    depth: Flags.integer({description: 'How many levels to return', exclusive: ['merged']}),
    merged: Flags.boolean({description: 'Merge the parent taxonomies into one tree', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTermTree)
    const client = this.client(flags)

    const res = flags.merged
      ? await client.hub.database.getDatabaseMergedTermTree({
          taxonomyName: args.taxonomy,
          databaseIntegrationId: flags.integration,
        })
      : await client.hub.database.getDatabaseTaxonomyTermTree({
          taxonomyName: args.taxonomy,
          rootTermId: flags.root,
          depth: flags.depth,
          databaseIntegrationId: flags.integration,
        })

    this.print(res)
    return res
  }
}
