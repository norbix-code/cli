import {BaseCommand} from '../../base.js'

export default class AccountMe extends BaseCommand {
  static description = `Show your own team-member record (owner or team member)

Not the organisation's profile (\`account profile\`): this is the person who is
signed in. \`generalInfo.phone\` is the number "Account users" SMS campaigns
send to; set it with \`account me set-phone\`.`

  static examples = ['<%= config.bin %> account me', '<%= config.bin %> account me --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AccountMe)
    const client = this.client(flags)

    const res = await client.hub.account.getMyAccountUserProfile({})

    this.print(res)
    return res
  }
}
