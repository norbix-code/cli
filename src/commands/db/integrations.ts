import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class DbIntegrations extends BaseCommand {
  static description = 'List the database integrations (the databases this project stores records in)'

  static examples = ['<%= config.bin %> db integrations']

  static flags = {
    'page-size': Flags.integer({description: 'Integrations per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
    before: Flags.string({description: 'Cursor: fetch the page before this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(DbIntegrations)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseIntegrations({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
      endingBefore: flags.before,
    })

    this.print(res)
    return res
  }
}
