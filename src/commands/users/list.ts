import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class UsersList extends BaseCommand {
  static description = 'List project users'

  static examples = [
    '<%= config.bin %> users list',
    '<%= config.bin %> users list --role admin --page-size 100',
  ]

  static flags = {
    role: Flags.string({description: 'Only users with this role (repeatable)', multiple: true}),
    permissions: Flags.boolean({description: 'Include permissions in the output', default: false}),
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(UsersList)
    const client = this.client(flags)

    const res = await client.api.membership.getUsers({
      roleNames: flags.role,
      includePermissions: flags.permissions,
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
