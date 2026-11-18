import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {databaseIntegrationFlag} from '../../../lib/database.js'

export default class DbTaxonomiesTree extends BaseCommand {
  static description = `Show every taxonomy as a tree (parents and their child taxonomies)

--include-terms also puts each taxonomy's term tree under it (a heavier
answer). Names come in the language of --language when set; --all-languages
keeps the stored names (every translation is in names / descriptions anyway).`

  static examples = ['<%= config.bin %> db taxonomies tree', '<%= config.bin %> db taxonomies tree --include-terms --json']

  static flags = {
    ...databaseIntegrationFlag,
    'include-terms': Flags.boolean({description: 'Add the term tree of every taxonomy', default: false}),
    'all-languages': Flags.boolean({description: 'Keep the stored names even when a language is asked for', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(DbTaxonomiesTree)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseTaxonomyTree({
      includeTerms: flags['include-terms'],
      allLanguages: flags['all-languages'],
      databaseIntegrationId: flags.integration,
    })

    this.print(res)
    return res
  }
}
