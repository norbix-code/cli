import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {databaseIntegrationFlag, readJsonText} from '../../../lib/database.js'
import {TAXONOMY_KEY_DESCRIPTION, dryRunTaxonomyId, taxonomyIdOf} from '../../../lib/taxonomy.js'

export default class DbTermCreate extends BaseCommand {
  static description = `Add one term to a taxonomy

The taxonomy is its id (txn_…) or its name — the same key every term command takes.`

  static examples = [
    `<%= config.bin %> db term create countries --doc '{"name":"Lithuania","order":1}'`,
    '<%= config.bin %> db term create txn_5BBS25C3IKHRfzVABMjMiM --doc @term.json',
    `<%= config.bin %> db term create countries --doc '{"name":"Lithuania"}' --dry-run`,
  ]

  static args = {
    taxonomyId: Args.string({required: true, description: TAXONOMY_KEY_DESCRIPTION}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    ...databaseIntegrationFlag,
    doc: Flags.string({char: 'd', required: true, description: 'The term as JSON — inline, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTermCreate)
    const client = this.client(flags)
    const taxonomyId = await this.lookup(flags, dryRunTaxonomyId(args.taxonomyId), (c) => taxonomyIdOf(c.hub, args.taxonomyId))

    const res = await client.hub.database.saveDatabaseTaxonomyTerm({
      taxonomyId,
      databaseIntegrationId: flags.integration,
      document: await readJsonText(flags.doc, 'doc'),
    })

    this.print(res)
    return res
  }
}
