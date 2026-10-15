import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PaymentsIntegrationEnable extends BaseCommand {
  static description = 'Turn a payments integration on'

  static examples = [
    '<%= config.bin %> payments integration enable 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> payments integration enable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PaymentsIntegrationEnable)
    const client = this.client(flags)

    // The route token is `{Id}`; the SDK fills it from `id` (the lookup is
    // case-insensitive), so the generated field is enough.
    const res = await client.hub.payments.enablePaymentsIntegration({id: args.id})

    this.print(`Integration ${args.id} enabled.`)
    return res
  }
}
