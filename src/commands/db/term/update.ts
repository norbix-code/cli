import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {databaseIntegrationFlag, readJsonText} from '../../../lib/database.js'

export default class DbTermUpdate extends BaseCommand {
  static description = `Change some fields of one taxonomy term

--set is a JSON object of the fields to change (applied with $set): name,
description, order, parentId, multiParents. Fields you leave out keep their value.`

  static examples = [
    `<%= config.bin %> db term update 66b2f0a1c3d4e5f6a7b8c9d0 66b2f0a1c3d4e5f6a7b8c9d1 --set '{"order":1}'`,
    '<%= config.bin %> db term update 66b2f0a1c3d4e5f6a7b8c9d0 66b2f0a1c3d4e5f6a7b8c9d1 --set @patch.json --dry-run',
  ]

  static args = {
    taxonomyId: Args.string({required: true, description: 'Taxonomy ID'}),
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

    const res = await client.hub.database.updateDatabaseTaxonomyTerm({
      taxonomyId: args.taxonomyId,
      id: args.id,
      databaseIntegrationId: flags.integration,
      update: await readJsonText(flags.set, 'set'),
    })

    this.print(`Term ${args.id} updated.`)
    return res
  }
}
