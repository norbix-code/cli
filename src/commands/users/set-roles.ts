import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {listOf} from '../../lib/membership.js'

export default class UsersSetRoles extends BaseCommand {
  static description = `Replace the roles of one login

The login gets exactly the --role roles (role names from \`norbix users roles\`).
With no --role it loses all roles. Sent to the Api host (the developer path).
For a person with several logins, \`norbix users contacts set-roles\` sets the
roles once for all of them.`

  static examples = [
    '<%= config.bin %> users set-roles usr_66b2f0a1c3d4 --role Editor --yes',
    '<%= config.bin %> users set-roles usr_66b2f0a1c3d4 --role Editor,Viewer --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Login ID (usr_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
    role: Flags.string({description: 'Role name (repeat for several, or a comma list)', multiple: true}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersSetRoles)
    const roles = listOf(flags.role) ?? []
    const client = this.client(flags)
    await this.confirmOrFail(
      roles.length > 0 ? `Replace the roles of ${args.id} with ${roles.join(', ')}?` : `Remove every role of ${args.id}?`,
      flags,
    )

    const res = await client.api.membership.assignRolePermissions({id: args.id, roles})
    this.print(roles.length > 0 ? `Login ${args.id} now has: ${roles.join(', ')}.` : `Login ${args.id} has no roles now.`)
    return res
  }
}
