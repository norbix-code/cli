# `norbix payments`

Manage the Payments module from the terminal. Norbix does not take payments:
it **receives the webhooks** your payment provider sends (Stripe, Apple
In-App, Google In-App, …), checks their signature, turns each one into one
event — `payments.webhook.received` — and runs your **payment triggers** on
it: send an email, SMS or push, call a webhook, run a function.

Every endpoint a person calls has a command. Every command is covered by
`tests/payments-routes.test.ts`, which runs it through the real SDK with
`fetch` replaced and checks the verb and path it sends, plus the request
fields of `save`, `test`, `webhook-log` and the toggles. No test contacts a
payment provider.

All paths below are under `/{version}/payments`.

## Module

| command | what it does | endpoint |
|---|---|---|
| `norbix payments enable` | turn the Payments module on | `PUT /enable` |
| `norbix payments disable [--yes]` | turn the Payments module off | `PUT /disable` |
| `norbix payments webhook-log [--integration <id>] [--limit <n>]` | the provider webhooks the project received, newest first | `GET /webhooks/log` |

`norbix module enable payments` / `norbix module disable payments` do the
same as the first two, for scripts that treat every module alike.

**Changed in 1.34:** up to 1.33, `payments enable <id>` and
`payments disable <id>` turned a *trigger* on or off. They now turn the
module on or off, like `sms enable` and `email enable`; the trigger toggles
are `payments trigger enable|disable <id>`. The old form fails with exit 2,
sends nothing, and its hint names the new command.

`webhook-log` shows one row per provider call: the integration, the provider,
the env, the event name and the provider's event ID, the HTTP status Norbix
answered (200 processed, 400 bad signature, 404 unknown integration, …) with
a description, and when it arrived. Look here first when a trigger did not
fire: no row means the provider never reached Norbix; a 400 usually means the
signing secret in the integration is wrong.

## Integrations

| command | what it does | endpoint |
|---|---|---|
| `norbix payments integrations` | list the integrations | `GET /integrations` |
| `norbix payments integration <id>` | show one integration | `GET /integrations/{id}` |
| `norbix payments integration save --provider <p> [--name <n>] [--id <id>] [--disabled] [--config <json>]` | create or update an integration | `POST /integrations` |
| `norbix payments integration test --integration <id>` | check the credentials with the provider | `POST /integrations/test` |
| `norbix payments integration confirm-delivery <id>` | confirm you checked the test result | `POST /integrations/confirm-human-delivery` |
| `norbix payments integration enable <id>` | turn it on | `PUT /integrations/{Id}/enable` |
| `norbix payments integration disable <id> [--yes]` | turn it off | `PUT /integrations/{Id}/disable` |
| `norbix payments integration delete <id> [--yes]` | delete it | `DELETE /integrations/{Id}` |

`--provider` is one of `Stripe`, `AppleInApp`, `GoogleInApp` (fully
supported), or `PayPal`, `Adyen`, `Paddle`, `LemonSqueezy`, `Mollie`,
`Shopify`, `WooCommerce`, `Magento`, `Braintree`, `AuthorizeNet`,
`CheckOutCom`, `Worldpay`. Put the provider-specific fields in `--config` as
a JSON object (inline, `@file.json`, or `-` for stdin). For Stripe:

```json
{"secretKey": "sk_test_…", "publishableKey": "pk_test_…", "webhookSigningSecret": "whsec_…"}
```

Use test-mode keys while you develop. `webhookSigningSecret` is the secret of
the Stripe webhook endpoint that points at Norbix. The portal shows that
endpoint's URL on the integration; its shape is
`POST /{version}/payments/webhooks/{accountId}/{projectId}/{provider}/{integrationId}`
(plus `?env=TEST` for a non-production copy of the integration).

```bash
norbix payments integration save --provider Stripe --name Stripe --config @stripe.json
norbix payments integration test --integration int_123
norbix payments integration confirm-delivery int_123
```

## Triggers

| command | what it does | endpoint |
|---|---|---|
| `norbix payments triggers` | list the payment triggers | `GET /triggers` |
| `norbix payments trigger <id>` | show one trigger | `GET /triggers/{id}` |
| `norbix payments trigger save --file <json> [--id <id>] [--event <name>]... [--integration <id>]... [--order <n>] [--[no-]break-on-error]` | create or update a trigger | `POST /triggers` |
| `norbix payments trigger enable <id>` | turn it on | `PATCH /triggers/{triggerId}/enable` |
| `norbix payments trigger disable <id> [--yes]` | turn it off | `PATCH /triggers/{triggerId}/disable` |
| `norbix payments trigger delete <id> [--yes]` | delete it | `DELETE /triggers/{triggerId}` |

The `--file` holds the trigger — the same shape `payments trigger <id> --json`
shows. `type` (`Payments`) and `when` (`OnWebhookCallReceived`, the only one
that fires) are filled in when the file leaves them out.

- `events` — the provider's own event names, e.g. `payment_intent.succeeded`
  or `charge.refunded`. Empty = every event in the server's list for that
  provider. A name the server does not know is refused.
- `integrations` — integration IDs. Empty = every payments integration.
- `action` — what to run: `{"type": "WebhookCall"}`, `Email`, `Sms`, `Push`,
  `Code`, `SseCall` or `Marketplace`, each with its own fields (the portal's
  trigger page builds them).

`--event` and `--integration` (repeat for several) replace the file's lists.
`--order` and `--break-on-error` set the trigger's place in the queue of the
same event, as for `db trigger create`.

```json
{"name": "Payment received", "events": ["payment_intent.succeeded"], "action": {"type": "WebhookCall"}}
```

```bash
norbix payments trigger save --file paid.json
norbix payments trigger save --file paid.json --event payment_intent.succeeded --event invoice.paid
norbix payments trigger disable trg_123 --yes
```

Templates of a trigger's email, SMS or push read the payment as
`@Model.Payment.*` tokens (`Payment.EventName`, `Payment.Amount`,
`Payment.Currency`, …). A function gets the payment as `data.payment` of
the `payments.webhook.received` event. A `WebhookCall` action sends the
`payments.webhook.received` event, with the payment as its data, to the
project's webhook destinations that listen to it (`norbix webhooks show`).

## Not offered on purpose

- The inbound webhook (`POST /payments/webhooks/{accountId}/…`) — the payment
  provider calls it, not a person.
- Orders, payment schemas, customers, plans and discounts — the Payments
  module is a webhook receiver in this phase; those parts are not live.
