import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushStop extends BaseCommand {
  static description = 'Stop a running push campaign'

  static examples = ['<%= config.bin %> push stop 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushStop)
    const client = this.client(flags)

    await this.confirmOrFail(`Stop push campaign ${args.id}?`, flags)

    // The route is `/campaigns/{Id}/stop` and the transport fills tokens by
    // exact name, but the generated request type has no field at all — so the
    // id goes in as `Id`. Sending `id` throws NORBIX_MISSING_PATH_PARAM.
    const res = await client.hub.notifications.stopPushCampaign({Id: args.id} as unknown as Parameters<
      typeof client.hub.notifications.stopPushCampaign
    >[0])

    this.print(`Campaign ${args.id} stopped.`)
    return res
  }
}
