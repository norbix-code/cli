import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {formatWebhookRun} from '../../lib/payments.js'

export default class PaymentsWebhookRun extends BaseCommand {
  static description = `Show one received payment webhook

The record of one event a payment gateway sent (a pwr_… id from
\`payments webhook-runs\`): what Norbix answered, what it did to the stored
order, every trigger the event reached with its action outcome (Sent, Skipped,
Failed, NotRun), and the payment fact the triggers got. --raw adds the call as
it came in — headers, body and Norbix's answer, with the payer's values masked
(kept 7 days). Without --raw the raw call is left out of --json too.`

  static examples = [
    '<%= config.bin %> payments webhook-run pwr_1p4R3gTobGZpD6fXvHT4rd',
    '<%= config.bin %> payments webhook-run pwr_1p4R3gTobGZpD6fXvHT4rd --raw',
    '<%= config.bin %> payments webhook-run pwr_1p4R3gTobGZpD6fXvHT4rd --raw --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'Received webhook run ID (pwr_…)'}),
  }

  static flags = {
    raw: Flags.boolean({default: false, description: 'Also show the raw call (payer values masked, kept 7 days)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PaymentsWebhookRun)
    const client = this.client(flags)

    const res = await client.hub.payments.getPaymentsWebhookRun({id: args.id})

    const shown = flags.raw || !res?.item ? res : {...res, item: {...res.item, raw: undefined}}
    this.print(formatWebhookRun(shown, {raw: flags.raw}))
    return shown
  }
}
