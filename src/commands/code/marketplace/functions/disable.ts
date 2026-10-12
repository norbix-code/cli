import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class CodeMarketplaceFunctionsDisable extends BaseCommand {
  static description = `Turn off a marketplace function

Calls, triggers and scheduler tasks that use it are refused until \`functions enable\`. Nothing is deleted.`

  static examples = [
    '<%= config.bin %> code marketplace functions disable func_4hT8rW2nQ6xLmP0vZ3kJ1c --connection int_6rBACnEaxQ0x1jTiHtAuWV --yes',
    '<%= config.bin %> code marketplace functions disable func_4hT8rW2nQ6xLmP0vZ3kJ1c --connection int_6rBACnEaxQ0x1jTiHtAuWV --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Function ID (func_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
    connection: Flags.string({required: true, description: 'Connection ID (int_…) the function belongs to'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceFunctionsDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Turn off marketplace function ${args.id}?`, flags)

    const res = await client.hub.code.disableMarketplaceFunction({integrationViewId: flags.connection, functionViewId: args.id})

    this.print(`Function ${args.id} disabled.`)
    return res
  }
}
