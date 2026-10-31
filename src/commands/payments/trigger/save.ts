import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {ON_WEBHOOK_CALL_RECEIVED, PAYMENT_TRIGGER_TYPES, PAYMENTS_TRIGGER, readJsonObject} from '../../../lib/payments.js'
import {executionIdentityFlag, triggerFromFile} from '../../../lib/triggers.js'

export default class PaymentsTriggerSave extends BaseCommand {
  static description = `Create or update a payment trigger from a JSON file

"when" says what fires it:
- OnWebhookCallReceived (default): a provider webhook (Stripe, Apple In-App,
  Google In-App, Montonio, Neopay, …) reached Norbix; "events" = provider event names
  such as payment_intent.succeeded.
- OnOrderPaid: a verified callback made a stored payment order Paid.
- OnOrderPaymentChanged: a stored order was paid, refunded, reversed or
  expired; "events" = payments.order.paid, payments.order.partially_refunded,
  payments.order.refunded, payments.order.reversed, payments.order.expired.
The file holds the trigger: name, the action ({type, ...}) and optionally
"integrations" (integration IDs; empty = every payments integration) and
"events" (empty = every event) — the same shape \`payments trigger <id> --json\`
shows. "type" is set to "Payments" and "when" to "OnWebhookCallReceived" when
the file leaves them out; --when overrides the file.

--event and --integration (repeat for several) replace the file's lists, --id
sets triggerId (update instead of create), --order and --break-on-error set the
trigger's place in the queue of the same event.

--execution-identity says who the trigger runs as; leave it out for the
project default. The Trigger subject audience works on membership triggers
only: a payment trigger refuses it.`

  static examples = [
    '<%= config.bin %> payments trigger save --file trigger.json',
    '<%= config.bin %> payments trigger save --file trigger.json --event payment_intent.succeeded --event charge.refunded',
    'cat trigger.json | <%= config.bin %> payments trigger save --file -',
    '<%= config.bin %> payments trigger save --file trigger.json --id 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
    '<%= config.bin %> payments trigger save --file order-paid.json --when OnOrderPaid',
    '<%= config.bin %> payments trigger save --file refunds.json --when OnOrderPaymentChanged --event payments.order.refunded',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    file: Flags.string({required: true, description: 'Trigger JSON file (or `-` for stdin)'}),
    id: Flags.string({description: 'Trigger ID — set it to update instead of create'}),
    when: Flags.string({description: 'What fires the trigger (overrides "when" in the file)', options: PAYMENT_TRIGGER_TYPES}),
    event: Flags.string({multiple: true, description: 'Event to react to — a provider event name, or payments.order.* for the order types (repeat for several; overrides "events")'}),
    integration: Flags.string({
      multiple: true,
      description: 'Payments integration ID to listen to (repeat for several; overrides "integrations")',
    }),
    'execution-identity': executionIdentityFlag,
    order: Flags.integer({
      min: 0,
      description: 'Place in the queue of the event: lower runs first, 0 or more (overrides "order" in the file)',
    }),
    'break-on-error': Flags.boolean({
      allowNo: true,
      description: 'Stop the later triggers of the same event when this one fails (overrides "breakOnError" in the file)',
    }),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PaymentsTriggerSave)
    const client = this.client(flags)

    const source = flags.file === '-' ? '-' : `@${flags.file}`
    const parsed = await readJsonObject(source, 'file')
    // The bare trigger, the request body or a `trigger <id> --json` answer.
    const fromFile = triggerFromFile(parsed)

    const trigger: Record<string, unknown> = {type: PAYMENTS_TRIGGER, when: ON_WEBHOOK_CALL_RECEIVED, ...fromFile}
    if (flags.id) trigger.triggerId = flags.id
    if (flags.when) trigger.when = flags.when
    if (flags.event) trigger.events = flags.event
    if (flags.integration) trigger.integrations = flags.integration
    if (flags['execution-identity']) trigger.executionIdentityId = flags['execution-identity']
    if (flags.order !== undefined) trigger.order = flags.order
    if (flags['break-on-error'] !== undefined) trigger.breakOnError = flags['break-on-error']

    // The payment-trigger fields are not on the generated base type, so the
    // body is cast: the server picks the shape from `type`.
    const res = await client.hub.payments.savePaymentsTrigger({trigger} as unknown as Parameters<
      typeof client.hub.payments.savePaymentsTrigger
    >[0])

    this.print(res)
    return res
  }
}
