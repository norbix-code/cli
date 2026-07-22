import {confirm} from '@inquirer/prompts'
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
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(WebhooksSecret)
    const client = this.client(flags)

    if (flags.rotate) {
      if (!flags.yes && process.stdout.isTTY) {
        const ok = await confirm({
          message: 'Rotate the webhook secret? Consumers still verifying with the old secret will fail.',
          default: false,
        })
        if (!ok) return this.print('Cancelled.')
      }

      const res = await client.hub.webhooks.rotateWebhookIntegrationSecret()
      this.print(res)
      return res
    }

    const res = await client.hub.webhooks.revealWebhookIntegrationSecret()
    this.print(res)
    return res
  }
}
