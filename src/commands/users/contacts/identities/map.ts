import {Args} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class UsersContactsIdentitiesMap extends BaseCommand {
  static description = `Recovery: attach an existing login to a contact when registration did not link it

Sign-up links a login to its person on its own; use this only when that did
not happen (a contact made with no login, or a link that failed). Sent to the
Api host (POST /membership/users/{id}/map-auth). For the normal case use
\`norbix users contacts identities add\`.`

  static examples = [
    '<%= config.bin %> users contacts identities map ct_66b2f0a1c3d4 usr_7a8b9c0d1e2f',
    '<%= config.bin %> users contacts identities map ct_66b2f0a1c3d4 usr_7a8b9c0d1e2f --dry-run',
  ]

  static args = {
    contact: Args.string({required: true, description: 'Contact ID (ct_…)'}),
    login: Args.string({required: true, description: 'Login ID (usr_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersContactsIdentitiesMap)
    const client = this.client(flags)

    const res = await client.api.membership.mapAuthToUser({userId: args.contact, authId: args.login})
    this.print(`Login ${args.login} attached to contact ${args.contact}.`)
    return res
  }
}
