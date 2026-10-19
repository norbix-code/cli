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
]

/**
 * One order line from `--line sku:quantity:unitCents[:title]` — e.g. `star-day:21:30`.
 * A title with spaces goes in --file instead.
 */
export function parseOrderLine(raw: string): {sku: string; quantity: number; unitAmountMinor: number; title?: string} {
  const [sku, quantity, unit, ...title] = raw.split(':')
  const q = Number(quantity)
  const u = Number(unit)
  if (!sku || !Number.isInteger(q) || q < 1 || !Number.isInteger(u) || u < 0) {
    throw new Error(`--line "${raw}" must be sku:quantity:unitCents[:title], e.g. star-day:21:30 (quantity 1 or more, cents 0 or more)`)
  }
  return title.length > 0 ? {sku, quantity: q, unitAmountMinor: u, title: title.join(':')} : {sku, quantity: q, unitAmountMinor: u}
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
