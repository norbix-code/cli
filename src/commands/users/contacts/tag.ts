import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class UsersContactsTag extends BaseCommand {
  static description = `Subscribe a contact to one message tag, or block it

The tag must already exist for the channel type. Sent to the Api host (the developer path).`

  static examples = [
    '<%= config.bin %> users contacts tag ct_66b2f0a1c3d4 Marketing Email newsletter --subscribed false',
    '<%= config.bin %> users contacts tag ct_66b2f0a1c3d4 Transactional Sms orders --subscribed true --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Contact ID (ct_…)'}),
    type: Args.string({required: true, description: 'Channel type', options: ['Marketing', 'Transactional']}),
    channel: Args.string({required: true, description: 'Delivery channel', options: ['Email', 'Sms', 'Push']}),
    tag: Args.string({required: true, description: 'Tag name'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    subscribed: Flags.string({required: true, description: 'true = get messages with this tag, false = block them', options: ['true', 'false']}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersContactsTag)
    const client = this.client(flags)
    const subscribed = flags.subscribed === 'true'

    const res = await client.api.membership.setContactTagSubscription({
      contactId: args.id,
      commChannel: args.type,
      channel: args.channel,
      tag: args.tag,
      subscribed,
    })
    this.print(`Contact ${args.id} ${subscribed ? 'subscribed to' : 'blocked'} tag ${args.tag} (${args.type} ${args.channel}).`)
    return res
  }
}
