import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PaymentsIntegrationConfirmDelivery extends BaseCommand {
  static description = `Confirm that you checked a payments integration's test result

After \`payments integration test\`, run this once you have seen the result
(for example the account in the provider's dashboard). It marks the
integration as proven to work.`

  static examples = [
    '<%= config.bin %> payments integration confirm-delivery 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> payments integration confirm-delivery 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PaymentsIntegrationConfirmDelivery)
    const client = this.client(flags)

    const res = await client.hub.payments.confirmPaymentsIntegrationHumanDelivery({integrationId: args.id})

    this.print(`Test result confirmed for integration ${args.id}.`)
    return res
  }
}
