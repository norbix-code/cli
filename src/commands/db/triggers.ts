import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class DbTriggers extends BaseCommand {
  static description = 'List schema triggers (actions that run when records change)'

  static examples = [
    '<%= config.bin %> db triggers',
    '<%= config.bin %> db triggers --schema 66b2f0a1c3d4e5f6a7b8c9d0',
  ]

  static flags = {
    schema: Flags.string({description: 'Only the triggers of this schema ID'}),
    'page-size': Flags.integer({description: 'Triggers per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
    before: Flags.string({description: 'Cursor: fetch the page before this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(DbTriggers)
    const client = this.client(flags)

    const res = await client.hub.database.getSchemaTriggers({
      schemaId: flags.schema,
      pageSize: flags['page-size'],
      startingAfter: flags.after,
      endingBefore: flags.before,
    })

    this.print(res)
    return res
  }
}
