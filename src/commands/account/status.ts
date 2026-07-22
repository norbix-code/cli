import {BaseCommand} from '../../base.js'

export default class AccountStatus extends BaseCommand {
  static description = 'Show the account status (plan, verification, limits)'

  static examples = ['<%= config.bin %> account status']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AccountStatus)
    const client = this.client(flags)

    const res = await client.hub.account.getAccountStatus({
    })

    this.print(res)
    return res
  }
}
