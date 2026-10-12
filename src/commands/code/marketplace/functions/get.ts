import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class CodeMarketplaceFunctionsGet extends BaseCommand {
  static description = `Show one marketplace function

Its key, arguments (the family values, Razor tokens allowed), declared inputs (what a caller must put in the payload), request template and token mappings.`

  static examples = ['<%= config.bin %> code marketplace functions get func_4hT8rW2nQ6xLmP0vZ3kJ1c --connection int_6rBACnEaxQ0x1jTiHtAuWV']

  static args = {
    id: Args.string({required: true, description: 'Function ID (func_…)'}),
  }

  static flags = {
    connection: Flags.string({required: true, description: 'Connection ID (int_…) the function belongs to'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceFunctionsGet)
    const client = this.client(flags)

    const res = await client.hub.code.getMarketplaceFunction({integrationViewId: flags.connection, functionViewId: args.id})

    this.print(res)
    return res
  }
}
