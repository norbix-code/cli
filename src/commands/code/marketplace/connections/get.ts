import {Args} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class CodeMarketplaceConnectionsGet extends BaseCommand {
  static description = `Show one marketplace connection

Its listing, config values (never the secrets — use the dashboard to reveal them), whether it is on, and lastValidationSteps: the result of the last \`connections validate\` run.`

  static examples = ['<%= config.bin %> code marketplace connections get int_6rBACnEaxQ0x1jTiHtAuWV']

  static args = {
    id: Args.string({required: true, description: 'Connection ID (int_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceConnectionsGet)
    const client = this.client(flags)

    const res = await client.hub.code.getMarketplaceIntegration({integrationViewId: args.id})

    this.print(res)
    return res
  }
}
