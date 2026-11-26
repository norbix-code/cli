import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AccountTeamMember extends BaseCommand {
  static description = `Show one team member

Their name and email, roles, phone number and push devices. Find the ID
(usr_…) in \`account team\`.`

  static examples = [
    '<%= config.bin %> account team member usr_3kQ9mZ2vXc8LpR4wT7yH1n',
    '<%= config.bin %> account team member usr_3kQ9mZ2vXc8LpR4wT7yH1n --json',
  ]

  static args = {
    memberId: Args.string({required: true, description: 'Team member ID (usr_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AccountTeamMember)
    const client = this.client(flags)

    const res = await client.hub.account.getTeamMember({memberId: args.memberId})

    this.print(res)
    return res
  }
}
