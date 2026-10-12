import {Args} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class CodeMarketplaceConnectionsDisable extends BaseCommand {
  static description = `Turn off a marketplace connection

Its functions stop answering calls, triggers and scheduler tasks until \`connections enable <id>\`. Nothing is deleted.`

  static examples = [
    '<%= config.bin %> code marketplace connections disable int_6rBACnEaxQ0x1jTiHtAuWV --yes',
    '<%= config.bin %> code marketplace connections disable int_6rBACnEaxQ0x1jTiHtAuWV --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Connection ID (int_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceConnectionsDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Turn off marketplace connection ${args.id}?`, flags)

    const res = await client.hub.code.disableMarketplaceIntegration({integrationViewId: args.id})

    this.print(`Connection ${args.id} disabled.`)
    return res
  }
}
