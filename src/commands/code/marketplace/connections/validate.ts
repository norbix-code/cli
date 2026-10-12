import {Args} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {formatValidation} from '../../../../lib/marketplace.js'

export default class CodeMarketplaceConnectionsValidate extends BaseCommand {
  static description = `Run a connection's validation steps

The listing's steps in order — e.g. Norbix Database: database.connect; Slack: config.complete, secrets.present, slack.auth — each ok, failed or skipped with its message. After a required step fails, the later ones are skipped. The last line says whether functions can be added: Add is refused until every step marked required has passed. The result is kept on the connection (lastValidationSteps).`

  static examples = [
    '<%= config.bin %> code marketplace connections validate int_6rBACnEaxQ0x1jTiHtAuWV',
    '<%= config.bin %> code marketplace connections validate int_6rBACnEaxQ0x1jTiHtAuWV --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'Connection ID (int_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceConnectionsValidate)
    const client = this.client(flags)

    const res = await client.hub.code.testMarketplaceIntegration({integrationViewId: args.id})

    this.print(formatValidation(res))
    return res
  }
}
