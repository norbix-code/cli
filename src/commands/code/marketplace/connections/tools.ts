import {Args} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {formatToolCatalog} from '../../../../lib/marketplace.js'

export default class CodeMarketplaceConnectionsTools extends BaseCommand {
  static description = `List the tools of an MCP connection

The tool catalog the gateway stored when the connection was last validated (\`connections validate\`): each tool's name, whether it only reads (read-only) or may change data (writes — the server's own hints), and its description. --json prints the full catalog: every tool's inputSchema (JSON Schema as text) plus listedAt, catalogHash and truncated. A connection that was never validated, or is not an MCP connection, has no catalog (CM-ERRORS-MARKETPLACE-020). Add a tool as a function with \`functions add --connection <int_id> --key <tool name>\`.`

  static examples = [
    '<%= config.bin %> code marketplace connections tools int_6rBACnEaxQ0x1jTiHtAuWV',
    '<%= config.bin %> code marketplace connections tools int_6rBACnEaxQ0x1jTiHtAuWV --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'MCP connection ID (int_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceConnectionsTools)
    const client = this.client(flags)

    const res = await client.hub.code.getMarketplaceIntegrationTools({integrationViewId: args.id})

    this.print(formatToolCatalog(res))
    return res
  }
}
