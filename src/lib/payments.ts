/**
 * Shared bits of the `payments` commands.
 */
export {readJsonObject} from './push.js'

/** The trigger type the server dispatches a payment trigger body by. */
export const PAYMENTS_TRIGGER = 'Payments'

/** A provider webhook reached Norbix (filters on the provider's own event names). */
export const ON_WEBHOOK_CALL_RECEIVED = 'OnWebhookCallReceived'

/**
 * The payment trigger types that fire. The two order types fire when a verified
 * callback changed a stored order (OnOrderPaid: it became Paid; OnOrderPaymentChanged:
 * paid, refunded, reversed or expired) and filter on the order events below.
 * OnOrderCreated is refused by the server (CM-ERRORS-PAYMENTS-007).
 */
export const PAYMENT_TRIGGER_TYPES = [ON_WEBHOOK_CALL_RECEIVED, 'OnOrderPaid', 'OnOrderPaymentChanged']

/** The Norbix order events an order trigger's "events" filter may name. */
export const PAYMENT_ORDER_EVENTS = [
  'payments.order.paid',
  'payments.order.partially_refunded',
  'payments.order.refunded',
  'payments.order.reversed',
  'payments.order.expired',
]

/** The provider names the server's integration converter accepts (PaymentGatewayPlatform). */
export const PAYMENT_PROVIDERS = [
  'Stripe',
  'AppleInApp',
  'GoogleInApp',
  'PayPal',
  'Adyen',
  'Paddle',
  'LemonSqueezy',
  'Mollie',
  'Shopify',
  'WooCommerce',
  'Magento',
  'Braintree',
  'AuthorizeNet',
  'CheckOutCom',
  'Worldpay',
  'Montonio',
  'Neopay',
]

/**
 * One order line from `--line sku:quantity:unitCents[:title]` — e.g. `star-day:21:30`.
 * The server requires a title on every line: without one, the sku is the title.
 * A title with spaces goes in --file instead.
 */
export function parseOrderLine(raw: string): {sku: string; quantity: number; unitAmountMinor: number; title?: string} {
  const [sku, quantity, unit, ...title] = raw.split(':')
  const q = Number(quantity)
  const u = Number(unit)
  if (!sku || !Number.isInteger(q) || q < 1 || !Number.isInteger(u) || u < 1) {
    throw new Error(`--line "${raw}" must be sku:quantity:unitCents[:title], e.g. star-day:21:30 (quantity 1 or more, cents 1 or more)`)
  }
  return {sku, quantity: q, unitAmountMinor: u, title: title.length > 0 ? title.join(':') : sku}
}

/** `--meta key=value` (repeatable) → a string map. */
export function parseMetadata(pairs: string[] | undefined): Record<string, string> | undefined {
  if (!pairs || pairs.length === 0) return undefined
  const out: Record<string, string> = {}
  for (const pair of pairs) {
    const at = pair.indexOf('=')
    if (at < 1) throw new Error(`--meta "${pair}" must be key=value`)
    out[pair.slice(0, at)] = pair.slice(at + 1)
  }
  return out
}

/** The `--outcome` values of `payments webhook-runs` (GetPaymentsWebhookRuns.Outcome). */
export const WEBHOOK_RUN_OUTCOMES = ['applied', 'ignored', 'refused', 'failed', 'all']

/** A trigger's action outcome on a received webhook, in the order the summary counts them. */
const ACTION_STATUSES = ['Sent', 'Skipped', 'Failed', 'NotRun']

interface WebhookRunAction {
  triggerId?: string
  triggerName?: string
  action?: string
  status?: string
  reason?: string
  queue?: string
  messageId?: string
  deliveries?: number
  norbixEvent?: string
  at?: string
}

interface WebhookRun {
  id?: string
  callId?: string
  env?: string
  integrationId?: string
  source?: string
  receivedOn?: string
  statusCode?: number
  outcome?: string
  reason?: string
  description?: string
  eventName?: string
  providerEventId?: string
  correlationId?: string
  fact?: unknown
  order?: {orderId?: string; kind?: string; from?: string; to?: string; reason?: string}
  actions?: WebhookRunAction[]
  part?: number
  parts?: number
}

interface WebhookRawCall {
  callId?: string
  receivedOn?: string
  contentType?: string
  body?: string
  truncated?: boolean
  maskedFields?: number
  headers?: Record<string, string>
  answerStatus?: number
  answerBody?: string
  parts?: number
}

/** Norbix's answer in one cell: `200 Applied`, `400 Refused — signature-mismatch`. */
export function webhookRunAnswer(run: WebhookRun): string {
  const head = `${run.statusCode ?? '?'} ${run.outcome ?? '?'}`
  return run.outcome === 'Applied' || !run.reason ? head : `${head} — ${run.reason}`
}

/** The trigger actions in one cell: `2 sent · 1 skipped`, `—` when the event reached no trigger. */
export function webhookRunTriggers(actions: WebhookRunAction[] | undefined): string {
  const list = actions ?? []
  if (list.length === 0) return '—'
  const counts = new Map<string, number>()
  for (const a of list) counts.set(a.status ?? '?', (counts.get(a.status ?? '?') ?? 0) + 1)
  const known = ACTION_STATUSES.filter((s) => counts.has(s))
  const other = [...counts.keys()].filter((s) => !ACTION_STATUSES.includes(s))
  return [...known, ...other]
    .map((s) => `${counts.get(s)} ${s === 'NotRun' ? 'not run' : s.toLowerCase()}`)
    .join(' · ')
}

/**
 * `payments webhook-runs` for the terminal: one row per received event, newest
 * first — when, which integration, which provider event, what Norbix answered,
 * what the triggers did — then the run id to read one, and the next page.
 */
export function formatWebhookRuns(res: unknown): string {
  const list = ((res ?? {}) as {list?: {items?: WebhookRun[]; hasMore?: boolean; startingAfter?: string}}).list ?? {}
  const runs = Array.isArray(list.items) ? list.items : []
  if (runs.length === 0) return 'No received payment webhooks match (records are kept 30 days).'

  const header = ['RECEIVED', 'INTEGRATION', 'EVENT', 'ANSWER', 'TRIGGERS', 'RUN']
  const rows = runs.map((r) => [
    r.receivedOn ?? '',
    r.source ? `${r.integrationId ?? '?'} (${r.source})` : (r.integrationId ?? '?'),
    `${r.eventName ?? '(unreadable)'}${(r.parts ?? 1) > 1 ? ` [${r.part ?? 1}/${r.parts}]` : ''}`,
    webhookRunAnswer(r),
    webhookRunTriggers(r.actions),
    r.id ?? '',
  ])
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i]!.length)))
  const line = (cells: string[]) => cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]!))).join('  ')
  const lines = [line(header), ...rows.map(line), '']
  lines.push(`${runs.length} run${runs.length === 1 ? '' : 's'}. Read one: norbix payments webhook-run <run>`)
  if (list.hasMore && list.startingAfter) lines.push(`More: add --after ${list.startingAfter}`)
  return lines.join('\n')
}

/** Pretty-print a JSON text; anything else comes back as it is. */
function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

/**
 * `payments webhook-run <id>` for the terminal: the answer, the order change,
 * one line per trigger action, the payment fact, and — with `raw` — the call as
 * it came in (payer values masked by the gateway).
 */
export function formatWebhookRun(res: unknown, opts: {raw?: boolean} = {}): string {
  const item = ((res ?? {}) as {item?: {run?: WebhookRun; raw?: WebhookRawCall | null}}).item
  const run = item?.run
  if (!run) return 'No such received payment webhook.'

  const lines = [
    `Run          ${run.id ?? '?'}${(run.parts ?? 1) > 1 ? ` (part ${run.part ?? 1} of ${run.parts})` : ''}, call ${run.callId ?? '?'}`,
    `Received     ${run.receivedOn ?? '?'} (env ${run.env ?? '?'})`,
    `Integration  ${run.integrationId ?? '?'}${run.source ? ` (${run.source})` : ''}`,
    `Event        ${run.eventName ?? '(the body could not be read)'}${run.providerEventId ? ` (provider id ${run.providerEventId})` : ''}`,
    `Answer       ${webhookRunAnswer(run)}${run.description ? `: ${run.description}` : ''}`,
  ]
  const o = run.order
  if (o) {
    const change = o.from || o.to ? ` ${o.from ?? '?'} → ${o.to ?? '?'}` : ''
    lines.push(`Order        ${o.orderId ?? '(none)'} ${o.kind ?? '?'}${change}${o.reason ? ` — ${o.reason}` : ''}`)
  } else {
    lines.push('Order        —')
  }
  if (run.correlationId) lines.push(`Log trail    norbix logs trail ${run.correlationId}`)

  const actions = run.actions ?? []
  lines.push('', `Triggers     ${webhookRunTriggers(actions)}`)
  if (actions.length > 0) {
    const header = ['STATUS', 'TRIGGER', 'ACTION', 'ON', 'DETAIL']
    const rows = actions.map((a) => {
      const detail = [
        a.reason,
        a.deliveries !== undefined && a.deliveries !== null ? `${a.deliveries} deliveries` : undefined,
        a.queue ? `queue ${a.queue}` : undefined,
        a.messageId ? `message ${a.messageId}` : undefined,
      ].filter(Boolean)
      return [
        a.status ?? '?',
        a.triggerName ? `${a.triggerName} (${a.triggerId ?? '?'})` : (a.triggerId ?? '?'),
        a.action ?? '—',
        a.norbixEvent ?? '',
        detail.join(', '),
      ]
    })
    const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i]!.length)))
    const line = (cells: string[]) => cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]!))).join('  ').trimEnd()
    lines.push(...[header, ...rows].map((cells) => `  ${line(cells)}`))
  }

  if (run.fact !== undefined && run.fact !== null) {
    lines.push('', 'Payment fact (what the triggers got):', JSON.stringify(run.fact, null, 2))
  }

  if (opts.raw) {
    const raw = item?.raw
    lines.push('')
    if (!raw) {
      lines.push('Raw call: not kept (raw calls are kept 7 days, and only for a call that reached a real integration).')
    } else {
      lines.push(
        `Raw call ${raw.callId ?? '?'}: ${raw.contentType ?? 'no content type'}, ${raw.maskedFields ?? 0} value(s) masked${raw.truncated ? ', body cut at 64 KB' : ''}${(raw.parts ?? 1) > 1 ? `, ${raw.parts} events` : ''}`,
      )
      for (const [k, v] of Object.entries(raw.headers ?? {})) lines.push(`  ${k}: ${v}`)
      lines.push('', prettyJson(raw.body ?? ''), '', `Answered ${raw.answerStatus ?? '?'}${raw.answerBody ? ` ${raw.answerBody}` : ''}`)
    }
  } else {
    lines.push('', 'The raw call (payer values masked, kept 7 days): add --raw')
  }
  return lines.join('\n')
}
