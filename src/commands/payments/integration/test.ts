import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PaymentsIntegrationTest extends BaseCommand {
  static description = `Check a payments integration's credentials with its provider

Calls the provider with the saved credentials (for Stripe: reads the account
behind the secret key — nothing is charged). A placeholder integration fails.`

  static examples = [
    '<%= config.bin %> payments integration test --integration 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> payments integration test --integration 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    integration: Flags.string({required: true, description: 'Integration ID to test'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PaymentsIntegrationTest)
    const client = this.client(flags)

    const res = await client.hub.payments.testPaymentsIntegration({integrationId: flags.integration})

    this.print(res)
    return res
  }
}
