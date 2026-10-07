import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {databaseIntegrationFlag} from '../../lib/database.js'
import {readJsonInput} from '../../lib/json.js'

export default class DbTerms extends BaseCommand {
  static description = `List the terms of a taxonomy

Pass --parent to list only the children of one term.`

  static examples = [
    '<%= config.bin %> db terms countries',
    `<%= config.bin %> db terms countries --filter '{"name":"Lithuania"}'`,
    '<%= config.bin %> db terms countries --parent 66b2f0a1c3d4e5f6a7b8c9d0',
  ]

  static args = {
    taxonomy: Args.string({required: true, description: 'Taxonomy name'}),
  }

  static flags = {
    ...databaseIntegrationFlag,
    filter: Flags.string({char: 'f', description: 'JSON filter (inline, @file or `-` for stdin)'}),
    parent: Flags.string({description: 'List only the children of this term ID'}),
    'page-size': Flags.integer({description: 'Terms per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
    before: Flags.string({description: 'Cursor: fetch the page before this item'}),
    desc: Flags.boolean({description: 'Sort descending', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTerms)
    const client = this.client(flags)

    const request = {
      taxonomyName: args.taxonomy,
      databaseIntegrationId: flags.integration,
      filter: flags.filter ? await readJsonInput(flags.filter, 'filter') : undefined,
      pageSize: flags['page-size'],
      startingAfter: flags.after,
      endingBefore: flags.before,
      sortDescending: flags.desc,
    }

    const res = flags.parent
      ? await client.api.database.findTermsChildren({...request, parentId: flags.parent})
      : await client.api.database.findTerms(request)

    this.print(res)
    return res
  }
}
