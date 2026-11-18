import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {explainDiscountRefusal} from '../../../lib/account.js'

export default class AccountDiscountApply extends BaseCommand {
  static description = `Put a discount code on the account's Managed Service subscription

This changes what the account pays. Norbix checks the code first (check it
yourself with \`norbix account discount check\`) and then changes the Stripe
subscription. The discount reaches the account when Stripe has confirmed
it, so \`norbix account status\` shows it a moment later.

A code that cannot be used is refused (CM-ERRORS-ACCOUNT-027) with the
reason; an account with no subscription is refused with
CM-ERRORS-PROJECTS-039. A code for a new subscription goes with the
checkout in Cloud.`

  static examples = [
    '<%= config.bin %> account discount apply LAUNCH30 --yes',
    '<%= config.bin %> account discount apply LAUNCH30 --dry-run',
  ]

  static args = {
    code: Args.string({required: true, description: 'The discount code, for example LAUNCH30'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AccountDiscountApply)
    const client = this.client(flags, {requireProject: false})

    await this.confirmOrFail(`Put the discount code ${args.code} on the account's subscription? This changes what the account pays.`, flags)

    try {
      const res = await client.hub.account.applyBundleDiscount({code: args.code})
      this.print(`The discount code ${args.code} was sent to Stripe. \`norbix account status\` shows the discount when Stripe has confirmed it.`)
      return res
    } catch (error) {
      throw explainDiscountRefusal(error, this.commandName)
    }
  }
}
