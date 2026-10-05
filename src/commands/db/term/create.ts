import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {databaseIntegrationFlag, readJsonText} from '../../../lib/database.js'

export default class DbTermCreate extends BaseCommand {
  static description = 'Add one term to a taxonomy'

  static examples = [
    `<%= config.bin %> db term create 66b2f0a1c3d4e5f6a7b8c9d0 --doc '{"name":"Lithuania","order":1}'`,
    '<%= config.bin %> db term create 66b2f0a1c3d4e5f6a7b8c9d0 --doc @term.json',
    `<%= config.bin %> db term create 66b2f0a1c3d4e5f6a7b8c9d0 --doc '{"name":"Lithuania"}' --dry-run`,
  ]

  static args = {
    taxonomyId: Args.string({required: true, description: 'Taxonomy ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    ...databaseIntegrationFlag,
    doc: Flags.string({char: 'd', required: true, description: 'The term as JSON — inline, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTermCreate)
    const client = this.client(flags)

    const res = await client.hub.database.saveDatabaseTaxonomyTerm({
      taxonomyId: args.taxonomyId,
      databaseIntegrationId: flags.integration,
      document: await readJsonText(flags.doc, 'doc'),
    })

    this.print(res)
    return res
  }
}
