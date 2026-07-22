import {confirm} from '@inquirer/prompts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushStop extends BaseCommand {
  static description = 'Stop a running push campaign'

  static examples = ['<%= config.bin %> push stop 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushStop)
    const client = this.client(flags)

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({message: `Stop push campaign ${args.id}?`, default: false})
      if (!ok) return this.print('Cancelled.')
    }

    const n = client.hub.notifications as unknown as {
      stopPushCampaign?: (r: {id: string}) => Promise<unknown>
    }
    if (!n.stopPushCampaign) {
      this.error(
        'Your installed @norbix.ai/ts does not support stopping campaigns yet.\n' +
          `Update the SDK, or run: norbix api "/{version}/notifications/push/campaigns/${args.id}/stop" --hub --method POST`,
      )
    }

    const res = await n.stopPushCampaign({id: args.id})
    this.print(`Campaign ${args.id} stopped.`)
    return res
  }
}
