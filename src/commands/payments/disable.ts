import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PaymentsDisable extends BaseCommand {
  static description = 'Disable a payment trigger'

  static examples = ['<%= config.bin %> payments disable 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PaymentsDisable)
    const client = this.client(flags)

    const res = await client.hub.payments.disablePaymentsTrigger({triggerId: args.id})
    this.print(`Trigger ${args.id} disabled.`)
    return res
  }
}
