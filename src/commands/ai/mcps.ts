import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class AiMcps extends BaseCommand {
  static description = 'List the MCP server integrations set up for this project'

  static examples = ['<%= config.bin %> ai mcps --page-size 50']

  static flags = {
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiMcps)
    const client = this.client(flags)

    const res = await client.hub.ai.getMcpIntegrations({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
