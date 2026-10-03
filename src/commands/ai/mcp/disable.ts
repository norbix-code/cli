import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiMcpDisable extends BaseCommand {
  static description = 'Turn off an MCP server integration'

  static examples = ['<%= config.bin %> ai mcp disable 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiMcpDisable)
    const client = this.client(flags)

    const res = await client.hub.ai.disableMcpIntegration({id: args.id})

    this.print(`Integration ${args.id} disabled.`)
    return res
  }
}
