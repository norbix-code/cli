import {Args} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class UsersContactsIdentitiesPromote extends BaseCommand {
  static description = `Make a login the contact's main login

The login must already be linked to the contact; it becomes the one used by default.`

  static examples = [
    '<%= config.bin %> users contacts identities promote ct_66b2f0a1c3d4 usr_7a8b9c0d1e2f',
    '<%= config.bin %> users contacts identities promote ct_66b2f0a1c3d4 usr_7a8b9c0d1e2f --dry-run',
  ]

  static args = {
    contact: Args.string({required: true, description: 'Contact ID (ct_…)'}),
    login: Args.string({required: true, description: 'Login ID (usr_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersContactsIdentitiesPromote)
    const client = this.client(flags)

    const res = await client.hub.membership.promoteContactIdentity({contactId: args.contact, authId: args.login})
    this.print(`Login ${args.login} is now the main login of contact ${args.contact}.`)
    return res
  }
}
