import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class WebhooksEnable extends BaseCommand {
  static description = 'Enable a webhook destination'

  static examples = ['<%= config.bin %> webhooks enable 66b2f0a1...']

  static args = {
    destinationId: Args.string({required: true, description: 'Destination ID'}),
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
