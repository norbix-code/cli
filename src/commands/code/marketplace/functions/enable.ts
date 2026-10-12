import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class CodeMarketplaceFunctionsEnable extends BaseCommand {
  static description = 'Turn a marketplace function back on'

  static examples = [
    '<%= config.bin %> code marketplace functions enable func_4hT8rW2nQ6xLmP0vZ3kJ1c --connection int_6rBACnEaxQ0x1jTiHtAuWV',
    '<%= config.bin %> code marketplace functions enable func_4hT8rW2nQ6xLmP0vZ3kJ1c --connection int_6rBACnEaxQ0x1jTiHtAuWV --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Function ID (func_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    connection: Flags.string({required: true, description: 'Connection ID (int_…) the function belongs to'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceFunctionsEnable)
    const client = this.client(flags)

    const res = await client.hub.code.enableMarketplaceFunction({integrationViewId: flags.connection, functionViewId: args.id})

    this.print(`Function ${args.id} enabled.`)
    return res
  }
}
