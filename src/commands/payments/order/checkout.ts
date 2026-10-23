import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PaymentsOrderCheckout extends BaseCommand {
  static description = `Start (or reuse) the checkout of a payment order

Sends the stored price to the payment provider and answers the payment URL
to send the buyer to. An open checkout that has more than two minutes left is
reused. --integration names the payments integration (a Montonio sandbox store or a
Neopay test project); --method is bankLink (default) or card (applePay / googlePay: Montonio only);
--return-url must be on one of the project's allowed origins. After the buyer
comes back, read the result with \`payments order <id>\` — the order moves only
when the provider's signed callback arrives.`

  static examples = [
    '<%= config.bin %> payments order checkout ord_2ToIiRM03X63TZaJ2dJdv2 --integration int_6KfKmvjN9KRVVzEWudjFs2 --return-url https://shop.example.com/paid',
    '<%= config.bin %> payments order checkout ord_2ToIiRM03X63TZaJ2dJdv2 --integration int_6KfKmvjN9KRVVzEWudjFs2 --return-url https://shop.example.com/paid --method bankLink --country LT',
    '<%= config.bin %> payments order checkout ord_2ToIiRM03X63TZaJ2dJdv2 --integration int_6KfKmvjN9KRVVzEWudjFs2 --return-url https://shop.example.com/paid --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Order ID (ord_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    integration: Flags.string({required: true, description: 'Payments integration ID that takes the payment'}),
    'return-url': Flags.string({required: true, description: "Where the buyer lands afterwards (an allowed origin of the project)"}),
    method: Flags.string({description: 'Payment method, e.g. bankLink, cardPayments (provider default if left out)'}),
    country: Flags.string({description: 'Preferred country of the bank list, e.g. LT'}),
    provider: Flags.string({description: 'Preferred bank / provider code inside the method'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PaymentsOrderCheckout)
    const client = this.client(flags)

    const res = await client.api.payments.startPaymentCheckout({
      id: args.id,
      integrationId: flags.integration,
      returnUrl: flags['return-url'],
      method: flags.method,
      preferredCountry: flags.country,
      preferredProvider: flags.provider,
    })

    this.print(res)
    return res
  }
}
