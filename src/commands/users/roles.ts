import {BaseCommand} from '../../base.js'

export default class UsersRoles extends BaseCommand {
  static description = 'List membership roles'

  static examples = ['<%= config.bin %> users roles']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(UsersRoles)
    const client = this.client(flags)

    const res = await client.hub.membership.getRoles({
    })

    this.print(res)
    return res
  }
}
