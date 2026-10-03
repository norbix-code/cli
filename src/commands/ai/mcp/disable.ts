import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiMcpDisable extends BaseCommand {
  static description = 'Turn off an MCP server integration'

  static examples = [
    '<%= config.bin %> ai mcp disable 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> ai mcp disable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiMcpDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Turn off MCP integration ${args.id}?`, flags)

    const res = await client.hub.ai.disableMcpIntegration({id: args.id})

    this.print(`Integration ${args.id} disabled.`)
    return res
  }
}
