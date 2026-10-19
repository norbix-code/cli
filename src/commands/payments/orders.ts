import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PaymentsOrders extends BaseCommand {
  static description = `List the project's payment orders, newest first

A payment order is created by the project's server (\`payments order create\`)
and moves when a verified provider callback pays, refunds or reverses it.
Filter by buyer, by your own merchant reference or by status.`

  static examples = [
    '<%= config.bin %> payments orders',
    '<%= config.bin %> payments orders --buyer usr_1szWVIyZFBV8HfvC4SfVw --status Paid',
    '<%= config.bin %> payments orders --reference ad-1042-promo-1',
  ]

  static flags = {
    buyer: Flags.string({description: 'Only the orders of this buyer (usr_…)'}),
    reference: Flags.string({description: 'Only the order with this merchant reference'}),
    status: Flags.string({
      description: 'Only orders in this status',
      options: ['Created', 'CheckoutStarted', 'Authorized', 'Paid', 'PartiallyRefunded', 'Refunded', 'Reversed', 'Expired'],
    }),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PaymentsOrders)
    const client = this.client(flags)

    const res = await client.api.payments.getPaymentOrders({
      buyerUserId: flags.buyer,
      merchantReference: flags.reference,
      status: flags.status,
    })

    this.print(res)
    return res
  }
}
