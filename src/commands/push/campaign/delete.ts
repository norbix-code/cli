import {confirm} from '@inquirer/prompts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PushCampaignDelete extends BaseCommand {
  static description = 'Delete a push campaign'

  static examples = ['<%= config.bin %> push campaign delete 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushCampaignDelete)
    const client = this.client(flags)

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({message: `Delete push campaign ${args.id}?`, default: false})
      if (!ok) return this.print('Cancelled.')
    }

    // The route is `/campaigns/{Id}` but the generated request type is empty,
    // so the id goes in as `Id` — the transport fills tokens by exact name.
    const res = await client.hub.notifications.deletePushCampaign({Id: args.id} as unknown as Parameters<
      typeof client.hub.notifications.deletePushCampaign
    >[0])

    this.print(`Campaign ${args.id} deleted.`)
    return res
  }
}
