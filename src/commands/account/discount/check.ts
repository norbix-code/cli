import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {BILLING_PERIODS, BUNDLES, type BundleDiscount, explainDiscountRefusal, formatDiscount} from '../../../lib/account.js'

export default class AccountDiscountCheck extends BaseCommand {
  static description = `Check a discount code for the Managed Service bundle and say what it gives

Nothing changes: the code is only checked. --bundle and --period are the
plan you are about to buy; leave them out to check the code against the
account's current plan. A code that cannot be used is refused
(CM-ERRORS-ACCOUNT-027) with the reason: not_found, not_started, expired,
not_for_bundle, monthly_only, wrong_billing_period, already_has_discount or
already_used. Put a code on the running subscription with
\`norbix account discount apply\`.`

  static examples = [
    '<%= config.bin %> account discount check LAUNCH30',
    '<%= config.bin %> account discount check LAUNCH30 --bundle growth --period monthly',
    '<%= config.bin %> account discount check LAUNCH30 --json',
  ]

  static args = {
    code: Args.string({required: true, description: 'The discount code, for example LAUNCH30'}),
  }

  static flags = {
    bundle: Flags.string({options: Object.keys(BUNDLES), description: 'The bundle you are about to buy (default: the current one)'}),
    period: Flags.string({options: Object.keys(BILLING_PERIODS), description: 'How it will be billed (default: the current period)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AccountDiscountCheck)
    const client = this.client(flags, {requireProject: false})
    const request: Record<string, string> = {code: args.code}
    if (flags.bundle) request.bundle = BUNDLES[flags.bundle as keyof typeof BUNDLES]
    if (flags.period) request.billingPeriod = BILLING_PERIODS[flags.period as keyof typeof BILLING_PERIODS]

    try {
      // The SDK types bundle and billingPeriod as its own enums; their values are these strings.
      const res = await client.hub.account.checkBundleDiscount(request as never)
      this.print(formatDiscount((res as {discount?: BundleDiscount}).discount))
      return res
    } catch (error) {
      throw explainDiscountRefusal(error, this.commandName)
    }
  }
}
