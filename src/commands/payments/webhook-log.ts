import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PaymentsWebhookLog extends BaseCommand {
  static description = `List the payment webhooks the project received, newest first

One row per provider call: the integration, the provider, the env, the event
name and the provider event ID, the HTTP status Norbix answered (200
processed, 400 bad signature, 404 unknown integration, …) with a description, and when it arrived.
Use it to check that Stripe (or another provider) reaches Norbix before you
look at a trigger's runs.`

  static examples = [
    '<%= config.bin %> payments webhook-log',
    '<%= config.bin %> payments webhook-log --integration 66b2f0a1c3d4e5f6a7b8c9d0 --limit 10',
  ]

  static flags = {
    integration: Flags.string({description: 'Only the rows of this payments integration'}),
    limit: Flags.integer({min: 1, max: 200, description: 'Rows to return (server default 50, at most 200)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PaymentsWebhookLog)
    const client = this.client(flags)

    const res = await client.hub.payments.getPaymentsWebhookLog({
      integrationId: flags.integration,
      limit: flags.limit,
    })

    this.print(res)
    return res
  }
}
