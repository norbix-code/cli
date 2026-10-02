import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailStop extends BaseCommand {
  static description = 'Stop a running email campaign'

  static examples = ['<%= config.bin %> email stop 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailStop)
    const client = this.client(flags)

    await this.confirmOrFail(`Stop email campaign ${args.id}?`, flags)

    // stop* methods are newer than SDK 1.2.0 — guard so older SDKs fail nicely.
    const n = client.hub.notifications as unknown as {
      stopEmailCampaign?: (r: {id: string}) => Promise<unknown>
    }
    if (!n.stopEmailCampaign) {
      this.error(
        'Your installed @norbix.ai/ts does not support stopping campaigns yet.\n' +
          `Update the SDK, or run: norbix api "/{version}/notifications/email/campaigns/${args.id}/stop" --hub --method POST`,
      )
    }

    const res = await n.stopEmailCampaign({id: args.id})
    this.print(`Campaign ${args.id} stopped.`)
    return res
  }
}
