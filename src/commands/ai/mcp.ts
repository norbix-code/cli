import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class AiMcp extends BaseCommand {
  static description = 'Show one MCP server integration'

  static examples = ['<%= config.bin %> ai mcp 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiMcp)
    const client = this.client(flags)

    const res = await client.hub.ai.getMcpIntegration({id: args.id})

    this.print(res)
    return res
  }
}
