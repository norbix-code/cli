import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class CodeMarketplaceFunctionsDelete extends BaseCommand {
  static description = `Delete a marketplace function

Triggers and scheduler tasks that call it fail from then on.`

  static examples = [
    '<%= config.bin %> code marketplace functions delete func_4hT8rW2nQ6xLmP0vZ3kJ1c --connection int_6rBACnEaxQ0x1jTiHtAuWV --yes',
    '<%= config.bin %> code marketplace functions delete func_4hT8rW2nQ6xLmP0vZ3kJ1c --connection int_6rBACnEaxQ0x1jTiHtAuWV --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Function ID (func_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
    connection: Flags.string({required: true, description: 'Connection ID (int_…) the function belongs to'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceFunctionsDelete)
    const client = this.client(flags)
    await this.confirmOrFail(`Delete marketplace function ${args.id}?`, flags)

    const res = await client.hub.code.deleteMarketplaceFunction({integrationViewId: flags.connection, functionViewId: args.id})

    this.print(`Function ${args.id} deleted.`)
    return res
  }
}
