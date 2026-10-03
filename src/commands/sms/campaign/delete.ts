import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class SmsCampaignDelete extends BaseCommand {
  static description = 'Delete an SMS campaign'

  static examples = [
    '<%= config.bin %> sms campaign delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> sms campaign delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsCampaignDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete SMS campaign ${args.id}?`, flags)

    const res = await client.hub.notifications.deleteSmsCampaign({id: args.id})

    this.print(`Campaign ${args.id} deleted.`)
    return res
  }
}
