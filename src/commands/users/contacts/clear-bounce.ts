import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class UsersContactsClearBounce extends BaseCommand {
  static description = `Clear a hard bounce, so messages on the channel are sent to the contact again

Use it after the address or number was fixed.`

  static examples = [
    '<%= config.bin %> users contacts clear-bounce ct_66b2f0a1c3d4 Email',
    '<%= config.bin %> users contacts clear-bounce ct_66b2f0a1c3d4 Sms --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Contact ID (ct_…)'}),
    channel: Args.string({required: true, description: 'Delivery channel', options: ['Email', 'Sms', 'Push']}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersContactsClearBounce)
    const client = this.client(flags)

    const res = await client.hub.membership.clearContactBounce({contactId: args.id, channel: args.channel})
    this.print(`Bounce on ${args.channel} cleared for contact ${args.id}.`)
    return res
  }
}
