import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PaymentsIntegrationsTestPayment extends BaseCommand {
  static description = `Open a real 0.01 test payment with a payments integration

Neopay and Montonio only. Prints the link to pay it: open it and pay
yourself; the provider then sends you back to --return-url. Other providers
answer CM-ERRORS-PAYMENTS-014.`

  static examples = [
    '<%= config.bin %> payments integrations test-payment int_4keCkFKOzSwFtgMiA28FRr --return-url https://shop.example.com/paid',
    '<%= config.bin %> payments integrations test-payment int_4keCkFKOzSwFtgMiA28FRr --return-url https://shop.example.com/paid --json',
    '<%= config.bin %> payments integrations test-payment int_4keCkFKOzSwFtgMiA28FRr --dry-run',
  ]

  static args = {
    integrationId: Args.string({required: true, description: 'Payments integration id'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    'return-url': Flags.string({
      description: 'Where the provider sends you back after paying: an https address (http only for localhost)',
      default: 'https://norbix.ai',
    }),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PaymentsIntegrationsTestPayment)
    const res = await this.client(flags).hub.payments.startPaymentsIntegrationTestPayment({
      integrationId: args.integrationId,
      returnUrl: flags['return-url'],
    })
    const amount = typeof res?.amountMinor === 'number' ? (res.amountMinor / 100).toFixed(2) : '0.01'
    this.print(res?.payUrl ? `Pay ${amount} ${res.currency ?? ''} here: ${res.payUrl}\nReference: ${res.reference ?? '-'}` : res)
    return res
  }
}
