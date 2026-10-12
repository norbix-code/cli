import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class CodeMarketplaceConnectionsList extends BaseCommand {
  static description = `List the project's marketplace connections

A connection is a listing enabled for this project and environment (int_…): its name, listing, transport, vendor, category and whether it is on. One listing may have many connections (two Slack workspaces, two databases).`

  static examples = [
    '<%= config.bin %> code marketplace connections list',
    '<%= config.bin %> code marketplace connections list --env TEST --json',
  ]

  static flags = {
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeMarketplaceConnectionsList)
    const client = this.client(flags)

    const res = await client.hub.code.getMarketplaceIntegrations({pageSize: flags['page-size'], startingAfter: flags.after})

    this.print(res)
    return res
  }
}
