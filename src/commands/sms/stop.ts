import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SmsStop extends BaseCommand {
  static description = 'Stop a running SMS campaign'

  static examples = [
    '<%= config.bin %> sms stop 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> sms stop 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

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

    const n = client.hub.notifications as unknown as {
      stopSmsCampaign?: (r: {id: string}) => Promise<unknown>
    }
    if (!n.stopSmsCampaign) {
      this.error(
        'Your installed @norbix.ai/ts does not support stopping campaigns yet.\n' +
          `Update the SDK, or run: norbix api "/{version}/notifications/sms/campaigns/${args.id}/stop" --hub --method POST`,
      )
    }

    const res = await n.stopSmsCampaign({id: args.id})
    this.print(`Campaign ${args.id} stopped.`)
    return res
  }
}
