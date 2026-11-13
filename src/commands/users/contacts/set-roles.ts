import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {listOf} from '../../../lib/membership.js'

export default class UsersContactsSetRoles extends BaseCommand {
  static description = `Replace a contact's roles

The contact gets exactly the --role roles, and so does every login it owns.
Roles are role IDs (pr_…_nr_…) from \`norbix users roles\`. With no --role the
contact loses all roles. Sent to the Api host (the developer path).`

  static examples = [
    '<%= config.bin %> users contacts set-roles ct_66b2f0a1c3d4 --role pr_1_nr_editor --yes',
    '<%= config.bin %> users contacts set-roles ct_66b2f0a1c3d4 --role pr_1_nr_editor,pr_1_nr_viewer --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Contact ID (ct_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
    role: Flags.string({description: 'Role ID (pr_…_nr_…); repeat for several, or a comma list', multiple: true}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersContactsSetRoles)
    const roles = listOf(flags.role) ?? []
    const client = this.client(flags)
    await this.confirmOrFail(
      roles.length > 0 ? `Replace the roles of ${args.id} with ${roles.join(', ')}?` : `Remove every role of ${args.id}?`,
      flags,
    )

    const res = await client.api.membership.setContactRoles({userId: args.id, roles})
    this.print(roles.length > 0 ? `Contact ${args.id} now has: ${roles.join(', ')}.` : `Contact ${args.id} has no roles now.`)
    return res
  }
}
