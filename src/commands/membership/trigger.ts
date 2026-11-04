import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class MembershipTrigger extends BaseCommand {
  static description = 'Show one membership trigger'

  static examples = ['<%= config.bin %> membership trigger 66b2f0a1c3d4e5f6a7b8c9d0', '<%= config.bin %> membership trigger 66b2f0a1c3d4e5f6a7b8c9d0 --json']

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(MembershipTrigger)
    const client = this.client(flags)

    const res = await client.hub.membership.getMembershipTrigger({id: args.id})

    this.print(res)
    return res
  }
}
