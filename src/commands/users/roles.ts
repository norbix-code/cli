import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class UsersRoles extends BaseCommand {
  static description = `List the project's roles, or show one role with its policies

Change them with \`norbix users roles create|update|delete\`.`

  static examples = ['<%= config.bin %> users roles', '<%= config.bin %> users roles pr_1_nr_editor --json']

  static args = {
    id: Args.string({required: false, description: 'Role ID: show this one role'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersRoles)
    const client = this.client(flags)

    const res = args.id ? await client.hub.membership.getRole({id: args.id}) : await client.hub.membership.getRoles({})

    this.print(res)
    return res
  }
}
