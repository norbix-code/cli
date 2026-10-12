import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../../base.js'
import {parseKeyValues} from '../../../../../lib/marketplace.js'

export default class CodeMarketplaceConnectionsSecretsSet extends BaseCommand {
  static description = `Replace the stored secrets of a connection

Replaces ALL stored secrets of the connection in the current environment with the ones given — pass every secret the listing needs, not only the one that changed. Values are never printed. Run \`connections validate\` afterwards.`

  static examples = [
    '<%= config.bin %> code marketplace connections secrets set int_6rBACnEaxQ0x1jTiHtAuWV --secret botToken=xoxb-…',
    '<%= config.bin %> code marketplace connections secrets set int_6rBACnEaxQ0x1jTiHtAuWV --secret apiKey=… --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Connection ID (int_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    secret: Flags.string({required: true, description: 'A secret value, key=value (repeat for more)', multiple: true}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceConnectionsSecretsSet)
    const secrets = parseKeyValues(flags.secret, 'secret') ?? {}
    const client = this.client(flags)

    const res = await client.hub.code.replaceMarketplaceIntegrationSecrets({integrationViewId: args.id, secrets})

    this.print(`Secrets of connection ${args.id} replaced (${Object.keys(secrets).join(', ')}).`)
    return res
  }
}
