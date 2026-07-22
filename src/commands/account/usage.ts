import {BaseCommand} from '../../base.js'

export default class AccountUsage extends BaseCommand {
  static description = 'Show usage-based billing for the account'

  static examples = ['<%= config.bin %> account usage']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AccountUsage)
    const client = this.client(flags)

    const res = await client.hub.account.getAccountUsageBilling({
    })

    this.print(res)
    return res
  }
}
