import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class WebhooksDisable extends BaseCommand {
  static description = 'Disable a webhook destination'

  static examples = ['<%= config.bin %> webhooks disable 66b2f0a1...']

  static args = {
    destinationId: Args.string({required: true, description: 'Destination ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(WebhooksDisable)
    const client = this.client(flags)

    const res = await client.hub.webhooks.disableWebhookDestination({
      destinationId: args.destinationId,
    })
    this.print(`Destination ${args.destinationId} disabled.`)
    return res
  }
}
