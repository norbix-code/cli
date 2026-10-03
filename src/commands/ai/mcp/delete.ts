import {confirm} from '@inquirer/prompts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiMcpDelete extends BaseCommand {
  static description = 'Delete an MCP server integration'

  static examples = ['<%= config.bin %> ai mcp delete 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiMcpDelete)
    const client = this.client(flags)

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({message: `Delete MCP server integration ${args.id}?`, default: false})
      if (!ok) return this.print('Cancelled.')
    }

    const res = await client.hub.ai.deleteMcpIntegration({id: args.id})

    this.print(`Integration ${args.id} deleted.`)
    return res
  }
}
