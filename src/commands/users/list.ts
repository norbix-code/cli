import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class UsersList extends BaseCommand {
  static description = `List the project's logins (users who can sign in)

Each row is one login (usr_…): its type, email or user name, roles and status.
A person with several logins is one contact: see \`norbix users contacts list\`.`

  static examples = [
    '<%= config.bin %> users list',
    '<%= config.bin %> users list --role admin --page-size 100',
    '<%= config.bin %> users list --search alice --status Active --type Email',
  ]

  static flags = {
    role: Flags.string({description: 'Only users with this role (repeatable)', multiple: true}),
    permissions: Flags.boolean({description: 'Include permissions in the output', default: false}),
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
    search: Flags.string({description: 'Text in the email, user name or name'}),
    email: Flags.string({description: 'Part of the email'}),
    status: Flags.string({
      description: 'Only logins with this status (repeatable)',
      multiple: true,
      options: ['Registered', 'PendingValidation', 'Active', 'Unregistered', 'Suspended', 'InActive', 'Blocked'],
    }),
    type: Flags.string({
      description: 'Only logins of this type (repeatable)',
      multiple: true,
      options: ['Service', 'Email', 'UserName', 'Phone', 'Guest', 'Social'],
    }),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(UsersList)
    const client = this.client(flags)

    const res = await client.api.membership.getUsers({
      roleNames: flags.role,
      includePermissions: flags.permissions,
      pageSize: flags['page-size'],
      startingAfter: flags.after,
      ...(flags.search ? {search: flags.search} : {}),
      ...(flags.email ? {email: flags.email} : {}),
      ...(flags.status ? {statuses: flags.status} : {}),
      ...(flags.type ? {types: flags.type} : {}),
    })

    this.print(res)
    return res
  }
}
