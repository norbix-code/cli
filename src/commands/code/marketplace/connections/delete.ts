import {Args} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class CodeMarketplaceConnectionsDelete extends BaseCommand {
  static description = `Delete a marketplace connection

The connection, its stored secrets and its functions go; triggers and tasks that call those functions fail from then on.`

  static examples = [
    '<%= config.bin %> code marketplace connections delete int_6rBACnEaxQ0x1jTiHtAuWV --yes',
    '<%= config.bin %> code marketplace connections delete int_6rBACnEaxQ0x1jTiHtAuWV --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Connection ID (int_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceConnectionsDelete)
    const client = this.client(flags)
    await this.confirmOrFail(`Delete marketplace connection ${args.id}?`, flags)

    const res = await client.hub.code.deleteMarketplaceIntegration({integrationViewId: args.id})

    this.print(`Connection ${args.id} deleted.`)
    return res
  }
}
