import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailCampaignDelete extends BaseCommand {
  static description = 'Delete an email campaign'

  static examples = [
    '<%= config.bin %> email campaign delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> email campaign delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailCampaignDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete email campaign ${args.id}?`, flags)

    const res = await client.hub.notifications.deleteEmailCampaign({id: args.id})

    this.print(`Campaign ${args.id} deleted.`)
    return res
  }
}
