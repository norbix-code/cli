import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class WebhooksRemove extends BaseCommand {
  static description = 'Remove a webhook destination'

  static examples = [
    '<%= config.bin %> webhooks remove 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> webhooks remove 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    destinationId: Args.string({required: true, description: 'Destination ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(WebhooksRemove)
    const client = this.client(flags)

    await this.confirmOrFail(`Remove webhook destination ${args.destinationId}?`, flags)

    const res = await client.hub.webhooks.removeWebhookDestination({
      destinationId: args.destinationId,
    })
    this.print(`Destination ${args.destinationId} removed.`)
    return res
  }
}
