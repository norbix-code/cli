import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class UsersPreferences extends BaseCommand {
  static description = `Show the marketing preferences of a login: blocked or not, and the tags it blocks

Change them with \`norbix users preferences set\`.`

  static examples = ['<%= config.bin %> users preferences usr_66b2f0a1c3d4', '<%= config.bin %> users preferences usr_66b2f0a1c3d4 --json']

  static args = {
    id: Args.string({required: true, description: 'Login ID (usr_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersPreferences)
    const client = this.client(flags)

    const res = await client.api.membership.getUserPreferences({id: args.id})
    this.print(res)
    return res
  }
}
