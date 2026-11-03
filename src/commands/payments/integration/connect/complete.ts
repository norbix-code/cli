import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class PaymentsIntegrationConnectComplete extends BaseCommand {
  static description = `Finish a payments quick connect with the picked account

After the person approved on the provider's page, list the accounts with
\`norbix integrations connect targets <connectId>\` and pass the one to use as
--target. The integration is saved like the manual form saves it, turned on
unless --disabled, and its id is printed.`

  static examples = [
    '<%= config.bin %> payments integration connect complete qc_1 --target shop_42',
    '<%= config.bin %> payments integration connect complete qc_1 --target shop_42 --disabled',
    '<%= config.bin %> payments integration connect complete qc_1 --target shop_42 --dry-run',
  ]

  static args = {
    connectId: Args.string({required: true, description: 'The connect id `connect start` printed'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    target: Flags.string({required: true, description: 'The id of the account (profile, shop) from `integrations connect targets`'}),
    disabled: Flags.boolean({description: 'Save the integration turned off', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PaymentsIntegrationConnectComplete)
    const client = this.client(flags)

    const res = await client.hub.payments.completePaymentsIntegrationConnect({
      connectId: args.connectId,
      targetId: flags.target,
      isEnabled: !flags.disabled,
    })

    this.print(res)
    return res
  }
}
