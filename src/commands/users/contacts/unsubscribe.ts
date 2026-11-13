import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class UsersContactsUnsubscribe extends BaseCommand {
  static description = `Stop marketing messages to a contact on one channel

The contact's consent on the channel is revoked. Sent to the Api host (the developer path).`

  static examples = [
    '<%= config.bin %> users contacts unsubscribe ct_66b2f0a1c3d4 Email',
    '<%= config.bin %> users contacts unsubscribe ct_66b2f0a1c3d4 Sms --reason UserRequest --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Contact ID (ct_…)'}),
    channel: Args.string({required: true, description: 'Delivery channel', options: ['Email', 'Sms', 'Push']}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    reason: Flags.string({description: 'Why the consent was revoked'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersContactsUnsubscribe)
    const client = this.client(flags)

    const res = await client.api.membership.unsubscribeContact({
      contactId: args.id,
      channel: args.channel,
      ...(flags.reason ? {reason: flags.reason} : {}),
    })
    this.print(`Contact ${args.id} unsubscribed from ${args.channel}.`)
    return res
  }
}
