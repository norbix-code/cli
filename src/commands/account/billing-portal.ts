import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class AccountBillingPortal extends BaseCommand {
  static description = 'Get a Stripe billing portal URL for the account'

  static examples = ['<%= config.bin %> account billing-portal']

  static flags = {
    type: Flags.string({description: 'Subscription type (backend enum, optional)'}),
    'return-url': Flags.string({description: 'Where Stripe sends the user back to'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AccountBillingPortal)
    const client = this.client(flags)

    const res = await client.hub.account.getStripeBillingPortalUrl({
      // Backend enum — passed through as-is when provided.
      ...(flags.type ? {subscriptionType: flags.type as never} : {}),
      returnUrl: flags['return-url'],
    })

    this.print(res)
    return res
  }
}
