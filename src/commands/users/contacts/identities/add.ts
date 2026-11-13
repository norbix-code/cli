import {Args} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class UsersContactsIdentitiesAdd extends BaseCommand {
  static description = `Link a login to a contact

From now on the person can sign in with this login (usr_…). Login IDs come
from \`norbix users list\` or \`norbix users contacts get\`.`

  static examples = [
    '<%= config.bin %> users contacts identities add ct_66b2f0a1c3d4 usr_7a8b9c0d1e2f',
    '<%= config.bin %> users contacts identities add ct_66b2f0a1c3d4 usr_7a8b9c0d1e2f --dry-run',
  ]

  static args = {
    contact: Args.string({required: true, description: 'Contact ID (ct_…)'}),
    login: Args.string({required: true, description: 'Login ID (usr_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersContactsIdentitiesAdd)
    const client = this.client(flags)

    const res = await client.hub.membership.addContactIdentity({contactId: args.contact, authId: args.login})
    this.print(`Login ${args.login} added to contact ${args.contact}.`)
    return res
  }
}
