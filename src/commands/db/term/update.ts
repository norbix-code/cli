import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {databaseIntegrationFlag, readJsonText} from '../../../lib/database.js'
import {TAXONOMY_KEY_DESCRIPTION, dryRunTaxonomyId, taxonomyIdOf} from '../../../lib/taxonomy.js'

export default class DbTermUpdate extends BaseCommand {
  static description = `Change some fields of one taxonomy term

--set is a JSON object of the fields to change (applied with $set): name,
description, order, parentId, multiParents. Fields you leave out keep their value.`

  static examples = [
    `<%= config.bin %> db term update countries 66b2f0a1c3d4e5f6a7b8c9d1 --set '{"order":1}'`,
    '<%= config.bin %> db term update countries 66b2f0a1c3d4e5f6a7b8c9d1 --set @patch.json --dry-run',
  ]

  static args = {
    taxonomyId: Args.string({required: true, description: TAXONOMY_KEY_DESCRIPTION}),
    id: Args.string({required: true, description: 'Term ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    ...databaseIntegrationFlag,
    set: Flags.string({char: 's', required: true, description: 'Fields to change as JSON — inline, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTermUpdate)
    const client = this.client(flags)
    const taxonomyId = await this.lookup(flags, dryRunTaxonomyId(args.taxonomyId), (c) => taxonomyIdOf(c.hub, args.taxonomyId))

    const res = await client.hub.database.updateDatabaseTaxonomyTerm({
      taxonomyId,
      id: args.id,
      databaseIntegrationId: flags.integration,
      update: await readJsonText(flags.set, 'set'),
    })

    this.print(`Term ${args.id} updated.`)
    return res
  }
}
