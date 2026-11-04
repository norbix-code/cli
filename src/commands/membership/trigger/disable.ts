import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class MembershipTriggerDisable extends BaseCommand {
  static description = 'Turn a membership trigger off'

  static examples = [
    '<%= config.bin %> membership trigger disable 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> membership trigger disable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(MembershipTriggerDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Turn off membership trigger ${args.id}?`, flags)

    // The server sets the trigger type from the route (Membership).
    const res = await client.hub.membership.disableMembershipTrigger({triggerId: args.id})

    this.print(`Trigger ${args.id} disabled.`)
    return res
  }
}
