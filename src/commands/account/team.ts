import {BaseCommand} from '../../base.js'

export default class AccountTeam extends BaseCommand {
  static description = 'List account collaborators (team members)'

  static examples = ['<%= config.bin %> account team']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AccountTeam)
    const client = this.client(flags)

    const res = await client.hub.account.getAccountCollaborators({
    })

    this.print(res)
    return res
  }
}
