import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PaymentsTriggerDisable extends BaseCommand {
  static description = 'Turn a payment trigger off'

  static examples = [
    '<%= config.bin %> payments trigger disable 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> payments trigger disable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PaymentsTriggerDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Turn off payment trigger ${args.id}?`, flags)

    const res = await client.hub.payments.disablePaymentsTrigger({triggerId: args.id})

    this.print(`Trigger ${args.id} disabled.`)
    return res
  }
}
