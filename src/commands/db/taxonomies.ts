import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class DbTaxonomies extends BaseCommand {
  static description = 'List database taxonomies'

  static examples = ['<%= config.bin %> db taxonomies']

  static flags = {
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(DbTaxonomies)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseTaxonomies({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
