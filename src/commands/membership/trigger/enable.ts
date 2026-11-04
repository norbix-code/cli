import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class MembershipTriggerEnable extends BaseCommand {
  static description = 'Turn a membership trigger on'

  static examples = [
    '<%= config.bin %> membership trigger enable 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> membership trigger enable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(MembershipTriggerEnable)
    const client = this.client(flags)
    // The server sets the trigger type from the route (Membership).
    const res = await client.hub.membership.enableMembershipTrigger({triggerId: args.id})

    this.print(`Trigger ${args.id} enabled.`)
    return res
  }
}
