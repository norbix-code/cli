import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class UsersRolesDelete extends BaseCommand {
  static description = `Delete a role; users who had it lose what it allowed

Built-in roles cannot be deleted. This cannot be undone.`

  static examples = ['<%= config.bin %> users roles delete pr_1_nr_editor --yes', '<%= config.bin %> users roles delete pr_1_nr_editor --dry-run']

  static args = {
    id: Args.string({required: true, description: 'Role ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersRolesDelete)
    const client = this.client(flags)
    await this.confirmOrFail(`Delete role ${args.id}? Users who have it lose what it allowed.`, flags)

    const res = await client.hub.membership.deleteRole({id: args.id})
    this.print(`Role ${args.id} deleted.`)
    return res
  }
}
