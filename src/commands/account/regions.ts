import {BaseCommand} from '../../base.js'

export default class AccountRegions extends BaseCommand {
  static description = 'List regions available to the account'

  static examples = ['<%= config.bin %> account regions']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AccountRegions)
    const client = this.client(flags)

    const res = await client.hub.account.getAccountRegions({
    })

    this.print(res)
    return res
  }
}
