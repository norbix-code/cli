import {BaseCommand} from '../../base.js'
import {formatBundles} from '../../lib/account.js'

export default class AccountBundles extends BaseCommand {
  static description = `List the Managed Service bundles: name, project limit, monthly and annual price

PROJECTS is how many enabled projects the bundle allows. Prices are per
month and per year, in the currency the account pays in. --json prints the
whole answer; there the amount is in minor units (5900 = 59.00) and the
currency is lower case. Move the account to another bundle with
\`norbix account change-bundle\`.`

  static examples = ['<%= config.bin %> account bundles', '<%= config.bin %> account bundles --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AccountBundles)
    const client = this.client(flags, {requireProject: false})

    const res = await client.hub.account.getManagedServiceBundles({})

    this.print(formatBundles(res))
    return res
  }
}
