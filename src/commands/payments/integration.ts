import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PaymentsIntegration extends BaseCommand {
  static description = 'Show one payments integration'

  static examples = ['<%= config.bin %> payments integration 66b2f0a1c3d4e5f6a7b8c9d0']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PaymentsIntegration)
    const client = this.client(flags)

    const res = await client.hub.payments.getPaymentsIntegration({id: args.id})

    this.print(res)
    return res
  }
}
