import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PaymentsTrigger extends BaseCommand {
  static description = 'Show one payment trigger'

  static examples = ['<%= config.bin %> payments trigger 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PaymentsTrigger)
    const client = this.client(flags)

    const res = await client.hub.payments.getPaymentsTrigger({id: args.id})

    this.print(res)
    return res
  }
}
