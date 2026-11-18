import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {usageError} from '../../../lib/cli-error.js'
import {databaseIntegrationFlag, readJsonText} from '../../../lib/database.js'
import {isEmptyFilter} from '../../../lib/records.js'

export default class DbTermDeleteMany extends BaseCommand {
  static description = `Delete the terms of a taxonomy that match a filter, or all of them

--filter is a MongoDB filter on the terms (inline JSON, @file or -); the
gateway adds the taxonomy itself, so it never reaches another taxonomy. The
gateway takes an empty filter ({}) as "every term" with no further check, so
the CLI refuses it: pass --all to delete every term on purpose.`

  static examples = [
    `<%= config.bin %> db term delete-many txn_1 --filter '{"meta.active":false}' --yes`,
    '<%= config.bin %> db term delete-many countries --all --yes',
    `<%= config.bin %> db term delete-many txn_1 --filter '{"name":"Old"}' --dry-run`,
  ]

  static args = {
    taxonomy: Args.string({required: true, description: 'Taxonomy ID (txn_…) or name'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
    ...databaseIntegrationFlag,
    filter: Flags.string({char: 'f', description: 'MongoDB filter on the terms; must not be empty', exclusive: ['all']}),
    all: Flags.boolean({description: 'Delete EVERY term of the taxonomy', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTermDeleteMany)
    if (!flags.filter && !flags.all) throw usageError('Pass --filter, or --all to delete every term.')

    let filter = '{}'
    if (flags.filter) {
      filter = await readJsonText(flags.filter, 'filter')
      if (isEmptyFilter(filter)) {
        throw usageError(`--filter '{}' matches every term of the taxonomy.`, 'To delete them all on purpose, use --all instead of --filter.')
      }
    }

    const client = this.client(flags)
    await this.confirmOrFail(
      flags.all ? `Delete EVERY term of taxonomy ${args.taxonomy}?` : `Delete the terms of taxonomy ${args.taxonomy} matching ${filter}?`,
      flags,
    )

    const res = await client.hub.database.deleteManyDatabaseTaxonomyTerms({
      taxonomyId: args.taxonomy,
      filter,
      databaseIntegrationId: flags.integration,
    })

    this.print(flags.all ? `Every term of taxonomy ${args.taxonomy} deleted.` : 'Matching terms deleted.')
    return res
  }
}
