import {BaseCommand} from '../../base.js'

export default class AccountProfile extends BaseCommand {
  static description = 'Show the account profile'

  static examples = ['<%= config.bin %> account profile']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AccountProfile)
    const client = this.client(flags)

    const res = await client.hub.account.getAccountProfile({
    })

    this.print(res)
    return res
  }
}
