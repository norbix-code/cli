import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class CodeMarketplaceFunctionsTokens extends BaseCommand {
  static description = `List the tokens a marketplace function reads

The @Model.X tokens its arguments and request template use — the ones a trigger action or a scheduler task must map (--token key=value) before the function can run. One per line; --json prints the answer.`

  static examples = ['<%= config.bin %> code marketplace functions tokens func_4hT8rW2nQ6xLmP0vZ3kJ1c --connection int_6rBACnEaxQ0x1jTiHtAuWV']

  static args = {
    id: Args.string({required: true, description: 'Function ID (func_…)'}),
  }

  static flags = {
    connection: Flags.string({required: true, description: 'Connection ID (int_…) the function belongs to'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceFunctionsTokens)
    const client = this.client(flags)

    const res = await client.hub.code.getMarketplaceFunctionTokens({integrationViewId: flags.connection, functionViewId: args.id})

    const tokens = (res as {tokens?: string[]}).tokens ?? []
    this.print(tokens.length ? tokens.join('\n') : 'The function reads no tokens.')
    return res
  }
}
