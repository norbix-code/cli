import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

/** `--role a --role b,c` → `['a', 'b', 'c']`; no flag → undefined (the project's default registration role). */
export function inviteRoles(values: string[] | undefined): string[] | undefined {
  const roles = (values ?? []).flatMap((v) => v.split(',')).map((r) => r.trim()).filter((r) => r.length > 0)
  return roles.length > 0 ? roles : undefined
}

export default class UsersInvite extends BaseCommand {
  static description = `Invite a user by email

With no --role the user gets the project's default registration role. An
administrator may give any role; other callers only the roles the project
permits at registration. An unknown role is refused (CM-ERRORS-MEMBERSHIP-001).`

  static examples = [
    '<%= config.bin %> users invite alice@example.com',
    '<%= config.bin %> users invite alice@example.com --role Editor',
    '<%= config.bin %> users invite alice@example.com --role Editor --role Viewer',
    '<%= config.bin %> users invite alice@example.com --role Editor,Viewer --dry-run',
    '<%= config.bin %> users invite alice@example.com --name "Alice Smith" --salutation Dear',
  ]

  static args = {
    email: Args.string({required: true, description: 'Email address to invite'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    role: Flags.string({
      multiple: true,
      description: "Role name or role ID to give (repeat for several, or a comma list); none = the project's default registration role",
    }),
    name: Flags.string({description: 'Full name of the person, used in the invitation email'}),
    salutation: Flags.string({description: 'Salutation used in the invitation email, e.g. Dear'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersInvite)
    const client = this.client(flags)

    const roles = inviteRoles(flags.role)
    const res = await client.api.membership.inviteUser({
      email: args.email,
      ...(roles ? {roles} : {}),
      ...(flags.name ? {fullName: flags.name} : {}),
      ...(flags.salutation ? {salutation: flags.salutation} : {}),
    })
    this.print(`Invitation sent to ${args.email}${roles ? ` with role${roles.length > 1 ? 's' : ''} ${roles.join(', ')}` : ''}.`)
    return res
  }
}
