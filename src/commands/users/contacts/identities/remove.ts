import {Args} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class UsersContactsIdentitiesRemove extends BaseCommand {
  static description = `Unlink a login from a contact

The person can no longer sign in with this login. The login itself is not deleted.`

  static examples = [
    '<%= config.bin %> users contacts identities remove ct_66b2f0a1c3d4 usr_7a8b9c0d1e2f --yes',
    '<%= config.bin %> users contacts identities remove ct_66b2f0a1c3d4 usr_7a8b9c0d1e2f --dry-run',
  ]

  static args = {
    contact: Args.string({required: true, description: 'Contact ID (ct_…)'}),
    login: Args.string({required: true, description: 'Login ID (usr_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersContactsIdentitiesRemove)
    const client = this.client(flags)
    await this.confirmOrFail(`Unlink login ${args.login} from contact ${args.contact}? The person can no longer sign in with it.`, flags)

    const res = await client.hub.membership.removeContactIdentity({contactId: args.contact, authId: args.login})
    this.print(`Login ${args.login} unlinked from contact ${args.contact}.`)
    return res
  }
}
