import {BaseCommand} from '../../base.js'

export default class UsersPolicies extends BaseCommand {
  static description = 'List membership policies'

  static examples = ['<%= config.bin %> users policies']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(UsersPolicies)
    const client = this.client(flags)

    const res = await client.hub.membership.getPolicies({
    })

    this.print(res)
    return res
  }
}
