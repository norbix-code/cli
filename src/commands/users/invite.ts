import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class UsersInvite extends BaseCommand {
  static description = 'Invite a user by email'

  static examples = ['<%= config.bin %> users invite alice@example.com']

  static args = {
    email: Args.string({required: true, description: 'Email address to invite'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersInvite)
    const client = this.client(flags)

    const res = await client.api.membership.inviteUser({email: args.email})
    this.print(`Invitation sent to ${args.email}.`)
    return res
  }
}
