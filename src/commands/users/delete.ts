import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class UsersDelete extends BaseCommand {
  static description = 'Delete a user'

  static examples = [
    '<%= config.bin %> users delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> users delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

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
