import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SmsStop extends BaseCommand {
  static description = 'Stop a running SMS campaign'

  static examples = ['<%= config.bin %> sms stop 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsStop)
    const client = this.client(flags)

    await this.confirmOrFail(`Stop SMS campaign ${args.id}?`, flags)

    // The route is `/campaigns/{Id}/stop`; the SDK (4.2.0) fills the token from
    // `id` — the lookup is case-insensitive — so the generated field is enough.
    const res = await client.hub.notifications.stopSmsCampaign({id: args.id})
    this.print(`Campaign ${args.id} stopped.`)
    return res
  }
}
