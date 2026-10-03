import {confirm} from '@inquirer/prompts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class SmsCampaignDelete extends BaseCommand {
  static description = 'Delete an SMS campaign'

  static examples = ['<%= config.bin %> sms campaign delete 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsCampaignDelete)
    const client = this.client(flags)

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({message: `Delete SMS campaign ${args.id}?`, default: false})
      if (!ok) return this.print('Cancelled.')
    }

    const res = await client.hub.notifications.deleteSmsCampaign({id: args.id})

    this.print(`Campaign ${args.id} deleted.`)
    return res
  }
}
