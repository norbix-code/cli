import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {databaseIntegrationFlag} from '../../../lib/database.js'

export default class DbTermDelete extends BaseCommand {
  static description = 'Delete one taxonomy term'

  static examples = [
    '<%= config.bin %> db term delete 66b2f0a1c3d4e5f6a7b8c9d0 66b2f0a1c3d4e5f6a7b8c9d1 --yes',
    '<%= config.bin %> db term delete 66b2f0a1c3d4e5f6a7b8c9d0 66b2f0a1c3d4e5f6a7b8c9d1 --dry-run',
  ]

  static args = {
    taxonomyId: Args.string({required: true, description: 'Taxonomy ID'}),
    id: Args.string({required: true, description: 'Term ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
    ...databaseIntegrationFlag,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTermDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete term ${args.id} from taxonomy ${args.taxonomyId}?`, flags)

    const res = await client.hub.database.deleteDatabaseTaxonomyTerm({
      taxonomyId: args.taxonomyId,
      id: args.id,
      databaseIntegrationId: flags.integration,
    })

    this.print(`Term ${args.id} deleted.`)
    return res
  }
}
