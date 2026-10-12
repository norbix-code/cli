import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class CodeMarketplaceFunctionsList extends BaseCommand {
  static description = `List the functions added to a marketplace connection

One row per function (func_…): its key (db.find, chat.postMessage, …), display name and whether it is on.`

  static examples = [
    '<%= config.bin %> code marketplace functions list --connection int_6rBACnEaxQ0x1jTiHtAuWV',
    '<%= config.bin %> code marketplace functions list --connection int_6rBACnEaxQ0x1jTiHtAuWV --json',
  ]

  static flags = {
    connection: Flags.string({required: true, description: 'Connection ID (int_…)'}),
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeMarketplaceFunctionsList)
    const client = this.client(flags)

    const res = await client.hub.code.getMarketplaceFunctions({
      integrationViewId: flags.connection,
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
