import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiMcpTest extends BaseCommand {
  static description = 'Check that an MCP server integration works: connect to the server'

  static examples = ['<%= config.bin %> ai mcp test 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiMcpTest)
    const client = this.client(flags)

    const res = await client.hub.ai.testMcpIntegration({integrationId: args.id})

    this.print(res)
    return res
  }
}
