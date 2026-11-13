import {Args} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

interface CatalogFunction {
  functionKey?: string
  displayName?: string
  description?: string
}

export default class CodeMarketplaceConnectionsCatalog extends BaseCommand {
  static description = `List the functions a connection's listing offers

The function definitions of the connection's listing — what \`functions add --key\` takes — one per line as its key, display name and description. --json prints every definition in full (parameters, inputs, form kind).`

  static examples = [
    '<%= config.bin %> code marketplace connections catalog int_6rBACnEaxQ0x1jTiHtAuWV',
    '<%= config.bin %> code marketplace connections catalog int_6rBACnEaxQ0x1jTiHtAuWV --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'Connection ID (int_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceConnectionsCatalog)
    const client = this.client(flags)

    const res = await client.hub.code.getMarketplaceFunctionCatalog({integrationViewId: args.id})

    const functions = ((res as {functions?: CatalogFunction[]}).functions ?? []) as CatalogFunction[]
    this.print(
      functions.length
        ? functions.map((f) => [f.functionKey ?? '', f.displayName ?? '', f.description ?? ''].filter(Boolean).join(' — ')).join('\n')
        : 'The listing offers no functions.',
    )
    return res
  }
}
