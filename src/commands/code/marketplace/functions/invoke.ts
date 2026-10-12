import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {readPayload} from '../../../../lib/code.js'

export default class CodeMarketplaceFunctionsInvoke extends BaseCommand {
  static description = `Call a marketplace function by hand

Sends the payload (a JSON object) as the call's request: each declared input is read from it (@Model.Request.<name>), and a missing required input is refused before the vendor is called. Runs as you — your roles decide what db.* built-ins may touch. Prints isSuccess, the function's output and the vendor's request id. Needs \`marketplace:execute\` on the function or its connection.`

  static examples = [
    `<%= config.bin %> code marketplace functions invoke func_4hT8rW2nQ6xLmP0vZ3kJ1c --payload '{"customerId":"6ac54a59212c29912eaddd81"}'`,
    '<%= config.bin %> code marketplace functions invoke func_4hT8rW2nQ6xLmP0vZ3kJ1c --payload-file payload.json --json',
    '<%= config.bin %> code marketplace functions invoke func_4hT8rW2nQ6xLmP0vZ3kJ1c --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Function ID (func_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    payload: Flags.string({description: 'JSON object sent as the request (inline, @file or - for stdin)'}),
    'payload-file': Flags.string({description: 'Read the payload from this JSON file'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceFunctionsInvoke)
    const payload = await readPayload(flags)
    const client = this.client(flags)

    const res = await client.hub.code.invokeMarketplaceFunction({
      functionViewId: args.id,
      payload: payload ?? {},
    } as Parameters<typeof client.hub.code.invokeMarketplaceFunction>[0])

    this.print(res)
    return res
  }
}
