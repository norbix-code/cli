import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class UsersDelete extends BaseCommand {
  static description = 'Delete a user'

  static examples = ['<%= config.bin %> users delete 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'User ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete user ${args.id}?`, flags)

    const res = await client.api.membership.deleteUser({id: args.id})
    this.print(`User ${args.id} deleted.`)
    return res
  }
}
