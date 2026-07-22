import {BaseCommand} from '../../base.js'

export default class WebhooksShow extends BaseCommand {
  static description = "Show the project's webhook integration (destinations, settings)"

  static examples = ['<%= config.bin %> webhooks show']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(WebhooksShow)
    const client = this.client(flags)

    const res = await client.hub.webhooks.getWebhookIntegration()
    this.print(res)
    return res
  }
}
