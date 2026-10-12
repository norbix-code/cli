import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {parseInputs, readArguments} from '../../../../lib/marketplace.js'

export default class CodeMarketplaceFunctionsAdd extends BaseCommand {
  static description = `Add a function to a marketplace connection

--key names a function the connection's listing offers (\`listings <ml_id>\` lists them with their parameters). Its values go in --arguments as a JSON object (inline, @file or -) and/or repeated --arg key=value; a non-string JSON value is sent as its JSON text. Razor tokens are allowed inside a value: @Model.Request.<input> reads the caller's payload, @Model.Project.Id the project. --input declares what a caller must send (name[:type[:required]], type string by default). The server checks the values (required arguments, JSON, the collection exists) and refuses Add until the connection's required validation steps passed. Prints the new id (func_…).`

  static examples = [
    `<%= config.bin %> code marketplace functions add --connection int_6rBACnEaxQ0x1jTiHtAuWV --key db.find --name "Paid orders" --arguments '{"collection":"orders","filter":{"status":"paid","customerId":"@Model.Request.customerId"},"pageSize":20}' --input customerId:string:required`,
    '<%= config.bin %> code marketplace functions add --connection int_6rBACnEaxQ0x1jTiHtAuWV --key chat.postMessage --arg channel=C0123 --arg "text=New order @Model.Request.orderNo" --input orderNo',
    '<%= config.bin %> code marketplace functions add --connection int_6rBACnEaxQ0x1jTiHtAuWV --key db.find --arguments @find-orders.json --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    connection: Flags.string({required: true, description: 'Connection ID (int_…)'}),
    key: Flags.string({required: true, description: 'Function key the listing offers, e.g. db.find'}),
    name: Flags.string({description: 'Display name; default: the key'}),
    description: Flags.string({description: 'Free text shown with the function'}),
    arguments: Flags.string({description: 'Argument values as a JSON object (inline, @file or -)'}),
    arg: Flags.string({description: 'One argument value, key=value (repeat for more; wins over --arguments)', multiple: true}),
    input: Flags.string({description: 'A declared invocation input, name[:type[:required]] (repeat for more)', multiple: true}),
    template: Flags.string({description: 'Request template (Razor JSON body) for a generic function; usually not needed'}),
    disabled: Flags.boolean({description: 'Add it turned off', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeMarketplaceFunctionsAdd)
    const args = await readArguments(flags)
    const inputs = parseInputs(flags.input)
    const client = this.client(flags)

    // No viewId: the server mints func_…; formKind lives on the listing's definition.
    const res = await client.hub.code.saveMarketplaceFunction({
      integrationViewId: flags.connection,
      function: {
        integrationViewId: flags.connection,
        functionKey: flags.key,
        displayName: flags.name ?? flags.key,
        description: flags.description,
        isEnabled: !flags.disabled,
        requestTemplate: flags.template,
        arguments: args ?? {},
        inputs: inputs ?? [],
      },
    } as unknown as Parameters<typeof client.hub.code.saveMarketplaceFunction>[0])

    this.print(`Function ${res?.id ?? ''} added.\nCall it: norbix code marketplace functions invoke ${res?.id ?? '<func_id>'} --payload '{…}'`)
    return res
  }
}
