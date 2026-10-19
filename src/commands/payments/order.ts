import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PaymentsOrder extends BaseCommand {
  static description = `Show one payment order

The order as stored: lines, total in cents, status, settled / refunded cents,
the provider payment id, and every checkout attempt. Read the status from here
after the buyer comes back from the bank — the return URL proves nothing.`

  static examples = ['<%= config.bin %> payments order ord_2ToIiRM03X63TZaJ2dJdv2']

  static args = {
    id: Args.string({required: true, description: 'Order ID (ord_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PaymentsOrder)
    const client = this.client(flags)

    const res = await client.api.payments.getPaymentOrder({id: args.id})

    this.print(res)
    return res
  }
}
