import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class UsersContactsList extends BaseCommand {
  static description = `List the project's people (contacts), newest first

This is the list on the dashboard's Users screen. One contact (ct_…) is one
person; it can own several logins (usr_…, see \`norbix users list\`). Pass the
nextCursor of an answer as --after to get the next page.`

  static examples = [
    '<%= config.bin %> users contacts list',
    '<%= config.bin %> users contacts list --search alice --page-size 20',
    '<%= config.bin %> users contacts list --status Blocked --type Email --tag vip --json',
  ]

  static flags = {
    search: Flags.string({description: 'Text in the email, phone, name or login user name; or an exact ct_… / usr_… id'}),
    email: Flags.string({description: 'Part of the email'}),
    'user-name': Flags.string({description: "Part of a login's user name"}),
    status: Flags.string({
      description: 'Only contacts with a login in this status (repeatable)',
      multiple: true,
      options: ['Registered', 'PendingValidation', 'Active', 'Unregistered', 'Suspended', 'InActive', 'Blocked'],
    }),
    type: Flags.string({
      description: 'Only contacts with a login of this type (repeatable)',
      multiple: true,
      options: ['Service', 'Email', 'UserName', 'Phone', 'Guest', 'Social'],
    }),
    role: Flags.string({description: 'Only contacts with this role id (pr_…_nr_…, repeatable)', multiple: true}),
    tag: Flags.string({description: 'Only contacts with this tag (repeatable)', multiple: true}),
    'page-size': Flags.integer({description: 'Contacts per page (default 50)'}),
    after: Flags.string({description: 'Cursor: the nextCursor of the previous page'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(UsersContactsList)
    const client = this.client(flags)

    const res = await client.hub.membership.getAllContacts({
      ...(flags.search ? {search: flags.search} : {}),
      ...(flags.email ? {email: flags.email} : {}),
      ...(flags['user-name'] ? {userName: flags['user-name']} : {}),
      ...(flags.status ? {statuses: flags.status} : {}),
      ...(flags.type ? {types: flags.type} : {}),
      ...(flags.role ? {roleNames: flags.role} : {}),
      ...(flags.tag ? {tags: flags.tag} : {}),
      ...(flags['page-size'] ? {pageSize: flags['page-size']} : {}),
      ...(flags.after ? {startingAfter: flags.after} : {}),
    })

    this.print(res)
    return res
  }
}
