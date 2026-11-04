import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class MembershipTriggerDelete extends BaseCommand {
  static description = 'Delete a membership trigger'

  static examples = [
    '<%= config.bin %> membership trigger delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> membership trigger delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(MembershipTriggerDelete)
    const client = this.client(flags)
    await this.confirmOrFail(`Delete membership trigger ${args.id}?`, flags)

    // The server sets the trigger type from the route (Membership).
    const res = await client.hub.membership.deleteMembershipTrigger({triggerId: args.id})

    this.print(`Trigger ${args.id} deleted.`)
    return res
  }
}
