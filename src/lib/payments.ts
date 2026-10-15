/**
 * Shared bits of the `payments` commands.
 */
export {readJsonObject} from './push.js'

/** The trigger type the server dispatches a payment trigger body by. */
export const PAYMENTS_TRIGGER = 'Payments'

/** The one payment trigger type that fires (the order types are refused, CM-ERRORS-PAYMENTS-007). */
export const ON_WEBHOOK_CALL_RECEIVED = 'OnWebhookCallReceived'

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
]
