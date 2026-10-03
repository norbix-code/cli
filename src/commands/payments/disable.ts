import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PaymentsDisable extends BaseCommand {
  static description = 'Disable a payment trigger'

  static examples = [
    '<%= config.bin %> payments disable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
    '<%= config.bin %> payments disable 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
  ]

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PaymentsDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Disable payment trigger ${args.id}?`, flags)

    const res = await client.hub.payments.disablePaymentsTrigger({triggerId: args.id})
    this.print(`Trigger ${args.id} disabled.`)
    return res
  }
}
