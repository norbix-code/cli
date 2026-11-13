import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class UsersContactsGet extends BaseCommand {
  static description = `Show one contact: profile, roles, tags, logins and marketing state`

  static examples = ['<%= config.bin %> users contacts get ct_66b2f0a1c3d4', '<%= config.bin %> users contacts get ct_66b2f0a1c3d4 --json']

  static args = {
    id: Args.string({required: true, description: 'Contact ID (ct_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersContactsGet)
    const client = this.client(flags)

    const res = await client.hub.membership.getContact({contactId: args.id})
    this.print(res)
    return res
  }
}
