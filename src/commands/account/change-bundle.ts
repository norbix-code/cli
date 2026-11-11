import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {BILLED, BILLING_PERIODS, BUNDLES, explainBundleRefusal} from '../../lib/account.js'

export default class AccountChangeBundle extends BaseCommand {
  static description = `Move the account to another Managed Service bundle or billing period

This changes what the account pays. Pass both the bundle and the period, also
when only one of them changes. The bundles, their project limits and prices:
\`norbix account bundles\`; what the account has now: \`norbix account status\`.

The change is sent to Stripe; the account follows when Stripe has confirmed
it, so \`norbix account status\` can show the old bundle for a short time.

A bundle that allows fewer enabled projects than the account has is refused
(CM-ERRORS-ACCOUNT-023): the message says how many projects to turn off first.`

  static examples = [
    '<%= config.bin %> account change-bundle --bundle growth --period annual --yes',
    '<%= config.bin %> account change-bundle --bundle starter --period monthly --dry-run',
  ]

  static flags = {
    ...BaseCommand.mutatingFlags,
    bundle: Flags.string({required: true, options: Object.keys(BUNDLES), description: 'The bundle to move to'}),
    period: Flags.string({required: true, options: Object.keys(BILLING_PERIODS), description: 'How the bundle is billed'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AccountChangeBundle)
    const client = this.client(flags, {requireProject: false})
    const bundle = BUNDLES[flags.bundle as keyof typeof BUNDLES]
    const billingPeriod = BILLING_PERIODS[flags.period as keyof typeof BILLING_PERIODS]
    const billed = BILLED[flags.period as keyof typeof BILLED]

    await this.confirmOrFail(`Move the account to the ${bundle} bundle, billed ${billed}? This changes what the account pays.`, flags)

    try {
      // The SDK types the two fields as its own enums; their values are these strings.
      const res = await client.hub.account.changeManagedServiceBundle({bundle: bundle as never, billingPeriod: billingPeriod as never})
      this.print(`The change to the ${bundle} bundle, billed ${billed}, was sent to Stripe. \`norbix account status\` shows it when Stripe has confirmed it.`)
      return res
    } catch (error) {
      throw explainBundleRefusal(error, this.commandName)
    }
  }
}
