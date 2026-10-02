import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class WebhooksEnable extends BaseCommand {
  static description = 'Enable a webhook destination'

  static examples = [
    '<%= config.bin %> webhooks enable 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> webhooks enable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    destinationId: Args.string({required: true, description: 'Destination ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(WebhooksEnable)
    const client = this.client(flags)

    const res = await client.hub.webhooks.enableWebhookDestination({
      destinationId: args.destinationId,
    })
    this.print(`Destination ${args.destinationId} enabled.`)
    return res
  }
}
