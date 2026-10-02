import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class WebhooksSecret extends BaseCommand {
  static description = 'Reveal the webhook signing secret, or rotate it with --rotate'

  static examples = [
    '<%= config.bin %> webhooks secret',
    '<%= config.bin %> webhooks secret --rotate --yes',
  ]

  static flags = {
    rotate: Flags.boolean({description: 'Rotate the secret (old secret stops working)', default: false}),
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(WebhooksSecret)
    const client = this.client(flags)

    if (flags.rotate) {
      await this.confirmOrFail('Rotate the webhook secret? Consumers still verifying with the old secret will fail.', flags)

      const res = await client.hub.webhooks.rotateWebhookIntegrationSecret()
      this.print(res)
      return res
    }

    const res = await client.hub.webhooks.revealWebhookIntegrationSecret()
    this.print(res)
    return res
  }
}
