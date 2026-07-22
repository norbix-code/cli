import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PaymentsEnable extends BaseCommand {
  static description = 'Enable a payment trigger'

  static examples = ['<%= config.bin %> payments enable 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PaymentsEnable)
    const client = this.client(flags)

    const res = await client.hub.payments.enablePaymentsTrigger({triggerId: args.id})
    this.print(`Trigger ${args.id} enabled.`)
    return res
  }
}
