import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class UsersBlock extends BaseCommand {
  static description = 'Block a user (they can no longer log in)'

  static examples = ['<%= config.bin %> users block 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'User ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersBlock)
    const client = this.client(flags)

    const res = await client.api.membership.blockUser({id: args.id})
    this.print(`User ${args.id} blocked.`)
    return res
  }
}
