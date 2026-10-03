import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class WebhooksDisable extends BaseCommand {
  static description = 'Disable a webhook destination'

  static examples = [
    '<%= config.bin %> webhooks disable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
    '<%= config.bin %> webhooks disable 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
  ]

  static args = {
    destinationId: Args.string({required: true, description: 'Destination ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(WebhooksDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Disable webhook destination ${args.destinationId}?`, flags)

    const res = await client.hub.webhooks.disableWebhookDestination({
      destinationId: args.destinationId,
    })
    this.print(`Destination ${args.destinationId} disabled.`)
    return res
  }
}
