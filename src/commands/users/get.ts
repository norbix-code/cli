import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class UsersGet extends BaseCommand {
  static description = 'Show one user'

  static examples = ['<%= config.bin %> users get 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'User ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersGet)
    const client = this.client(flags)

    const res = await client.api.membership.getUser({id: args.id})
    this.print(res)
    return res
  }
}
