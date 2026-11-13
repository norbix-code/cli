import {Args} from '@oclif/core'

import {BaseCommand} from '../../../../../base.js'

export default class CodeMarketplaceConnectionsSecretsReveal extends BaseCommand {
  static description = `Show the stored secrets of a connection, in plain text

Prints every stored secret of the connection in the current environment as key=value. The values are secrets: they end up in your terminal and its history, so it asks first (--yes in a script); the gateway may refuse it for your role.`

  static examples = [
    '<%= config.bin %> code marketplace connections secrets reveal int_6rBACnEaxQ0x1jTiHtAuWV --yes',
    '<%= config.bin %> code marketplace connections secrets reveal int_6rBACnEaxQ0x1jTiHtAuWV --yes --json',
    '<%= config.bin %> code marketplace connections secrets reveal int_6rBACnEaxQ0x1jTiHtAuWV --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Connection ID (int_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceConnectionsSecretsReveal)
    const client = this.client(flags)
    await this.confirmOrFail(`Print the stored secrets of connection ${args.id} in plain text?`, flags)

    const res = await client.hub.code.revealMarketplaceIntegrationSecrets({integrationViewId: args.id})

    const secrets = (res as {secrets?: Record<string, string>}).secrets ?? {}
    const keys = Object.keys(secrets)
    this.print(keys.length ? keys.map((k) => `${k}=${secrets[k]}`).join('\n') : 'The connection has no stored secrets.')
    return res
  }
}
