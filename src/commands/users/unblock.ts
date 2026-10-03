import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class UsersUnblock extends BaseCommand {
  static description = 'Unblock a user'

  static examples = [
    '<%= config.bin %> users unblock 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> users unblock 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'User ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersUnblock)
    const client = this.client(flags)

    const res = await client.api.membership.unblockUser({id: args.id})
    this.print(`User ${args.id} unblocked.`)
    return res
  }
}
