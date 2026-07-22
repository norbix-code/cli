import {BaseCommand} from '../../base.js'

export default class AccountProjects extends BaseCommand {
  static description = 'List all projects in the account'

  static examples = ['<%= config.bin %> account projects']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AccountProjects)
    const client = this.client(flags)

    const res = await client.hub.account.getProjects({
    })

    this.print(res)
    return res
  }
}
