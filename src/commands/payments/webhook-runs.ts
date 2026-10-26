import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {formatWebhookRuns, WEBHOOK_RUN_OUTCOMES} from '../../lib/payments.js'

export default class PaymentsWebhookRuns extends BaseCommand {
  static description = `List the received payment webhooks as records, newest first

One row per event a payment gateway sent to the project's webhook URL (kept 30
days): when it arrived, the integration, the provider's event name, what Norbix
answered (200 Applied, 200 Ignored — duplicate, 400 Refused — <reason>, 500
Failed — <reason>) and what the triggers did with it (2 sent · 1 skipped). Use it
to find out why a payment trigger did or did not fire; read one record with
\`payments webhook-run <run>\`. --json prints the page as the Hub sent it.`

  static examples = [
    '<%= config.bin %> payments webhook-runs',
    '<%= config.bin %> payments webhook-runs --outcome refused --integration int_4f2a9c --from 2026-10-25T00:00:00Z',
    '<%= config.bin %> payments webhook-runs --trigger trg_8d1e0b --page-size 20 --after pwr_1p4R3gTobGZpD6fXvHT4rd',
  ]

  static flags = {
    integration: Flags.string({description: 'Only events posted to this payments integration (int_…)'}),
    event: Flags.string({description: "Only this provider event name (e.g. payment_intent.succeeded, payment.success)"}),
    trigger: Flags.string({description: 'Only events that reached this trigger (trg_…)'}),
    outcome: Flags.string({
      options: WEBHOOK_RUN_OUTCOMES,
      description: 'applied (processed), ignored (200, e.g. duplicate), refused (4xx), failed (5xx) or all (default)',
    }),
    from: Flags.string({description: 'Received at or after this time (UTC, ISO 8601)'}),
    to: Flags.string({description: 'Received at or before this time (UTC, ISO 8601)'}),
    'page-size': Flags.integer({min: 1, description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this run (pwr_…)', exclusive: ['before']}),
    before: Flags.string({description: 'Cursor: fetch the page before this run (pwr_…)', exclusive: ['after']}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PaymentsWebhookRuns)
    const client = this.client(flags)

    const res = await client.hub.payments.getPaymentsWebhookRuns({
      integrationId: flags.integration,
      eventName: flags.event,
      triggerId: flags.trigger,
      outcome: flags.outcome,
      fromUtc: flags.from,
      toUtc: flags.to,
      pageSize: flags['page-size'],
      startingAfter: flags.after,
      endingBefore: flags.before,
    })

    this.print(formatWebhookRuns(res))
    return res
  }
}
