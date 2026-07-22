import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class DbSchemas extends BaseCommand {
  static description = 'List database schemas (collections definitions)'

  static examples = ['<%= config.bin %> db schemas']

  static flags = {
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(DbSchemas)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseSchemas({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
