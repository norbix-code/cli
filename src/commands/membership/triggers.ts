import {BaseCommand} from '../../base.js'

export default class MembershipTriggers extends BaseCommand {
  static description = 'List the membership triggers'

  static examples = ['<%= config.bin %> membership triggers', '<%= config.bin %> membership triggers --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipTriggers)
    const client = this.client(flags)

    const res = await client.hub.membership.getMembershipTriggers({})

    this.print(res)
    return res
  }
}
