import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PaymentsTriggerEnable extends BaseCommand {
  static description = 'Turn a payment trigger on'

  static examples = [
    '<%= config.bin %> payments trigger enable 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> payments trigger enable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PaymentsTriggerEnable)
    const client = this.client(flags)

    // The server sets the trigger type from the route (Payments).
    const res = await client.hub.payments.enablePaymentsTrigger({triggerId: args.id})

    this.print(`Trigger ${args.id} enabled.`)
    return res
  }
}
