import {confirm} from '@inquirer/prompts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class WebhooksRemove extends BaseCommand {
  static description = 'Remove a webhook destination'

  static examples = ['<%= config.bin %> webhooks remove 66b2f0a1... --yes']

  static args = {
    destinationId: Args.string({required: true, description: 'Destination ID'}),
  }

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(WebhooksRemove)
    const client = this.client(flags)

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({
        message: `Remove webhook destination ${args.destinationId}?`,
        default: false,
      })
      if (!ok) return this.print('Cancelled.')
    }

    const res = await client.hub.webhooks.removeWebhookDestination({
      destinationId: args.destinationId,
    })
    this.print(`Destination ${args.destinationId} removed.`)
    return res
  }
}
