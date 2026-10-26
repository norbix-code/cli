# `norbix payments`

Manage the Payments module from the terminal. Norbix **receives the webhooks**
your payment provider sends (Stripe, Apple In-App, Google In-App, Montonio, …),
checks their signature, turns each one into one event —
`payments.webhook.received` — and runs your **payment triggers** on it: send
an email, SMS or push, call a webhook, run a function. With **payment orders**
your server creates an order at a fixed price, Norbix opens the provider's
checkout for it (Montonio sandbox: Lithuanian bank links, cards, Apple Pay,
Google Pay), and the provider's signed callback moves the order — which fires
the order triggers.

Every endpoint a person calls has a command. Every command is covered by
`tests/payments-routes.test.ts`, which runs it through the real SDK with
`fetch` replaced and checks the verb and path it sends, plus the request
fields of `save`, `test`, `webhook-log`, `webhook-runs` and the toggles. No test contacts a
payment provider.

All paths below are under `/{version}/payments`. The order commands go to the
Api host, everything else to the Hub.

## Module

| command | what it does | endpoint |
|---|---|---|
| `norbix payments enable` | turn the Payments module on | `PUT /enable` |
| `norbix payments disable [--yes]` | turn the Payments module off | `PUT /disable` |
| `norbix payments webhook-log [--integration <id>] [--limit <n>]` | the provider webhooks the project received, newest first | `GET /webhooks/log` |
| `norbix payments webhook-runs [--integration <id>] [--event <name>] [--trigger <id>] [--outcome <o>] [--from <utc>] [--to <utc>] [--page-size <n>] [--after <run> \| --before <run>]` | the received webhooks as records: answer, order change, trigger outcomes | `GET /webhooks/runs` |
| `norbix payments webhook-run <run> [--raw]` | one record, with the masked raw call on `--raw` | `GET /webhooks/runs/{Id}` |

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

### Received webhooks as records: `webhook-runs` and `webhook-run`

Since gateway 86f24ecd2 every event a payment gateway sends is also kept as a
record for 30 days: the payment fact, Norbix's answer, what happened to the
stored order, and every trigger the event reached with what its action did.
Use these when the question is "why did my trigger (not) fire?".

```
$ norbix payments webhook-runs --outcome refused
RECEIVED              INTEGRATION          EVENT                     ANSWER                            TRIGGERS            RUN
2026-10-26T08:00:00Z  int_stripe (Stripe)  payment_intent.succeeded  400 Refused — signature-mismatch  —                   pwr_1p4R3gTobGZpD6fXvHT4rd

1 run. Read one: norbix payments webhook-run <run>
```

- **ANSWER** is the HTTP status and outcome Norbix answered: `200 Applied`
  (processed), `200 Ignored — duplicate`, `400 Refused — <reason>` (for
  example a wrong signing secret), `500 Failed — <reason>` (the provider
  retries).
- **TRIGGERS** counts the trigger actions by result: `2 sent · 1 skipped`
  (also `failed` and `not run` — an earlier trigger with "break on failure"
  failed); `—` when the event reached no trigger.
- Filters: `--integration`, `--event` (the provider's event name), `--trigger`,
  `--outcome` (`applied`, `ignored`, `refused`, `failed`, `all`), `--from` /
  `--to` (UTC, ISO 8601). Paging: `--page-size`, then `--after <run>` (the
  command prints it) or `--before <run>`.
- A gateway call that carries several events (Neopay: one token, many
  transactions) is several runs; the event shows `[2/3]`.

`norbix payments webhook-run <run>` prints the record: the answer with its
description, the order change (`ord_… Applied Pending → Paid`), a line per
trigger (status, trigger, action, the Norbix event it fired on, the reason,
deliveries or queue), the payment fact the triggers got, and the command that
opens the log trail. `--raw` adds the call as it came in — the safe headers,
the body and Norbix's answer — with the payer's personal values masked by the
gateway; raw calls are kept 7 days. Without `--raw` the raw call is left out
of `--json` as well.

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
`CheckOutCom`, `Worldpay`, `Montonio`. Put the provider-specific fields in `--config` as
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

For Montonio (the checkout provider of payment orders), the keys of a Montonio
**sandbox** store — production stays off until the owner turns it on:

```json
{"accessKey": "…", "secretKey": "…", "isSandbox": true, "locale": "lt"}
```

`isSandbox` is optional: empty = true (sandbox). Leave it out or send `true`;
only an explicit `false` points the integration at a live store.

```bash
norbix payments integration save --provider Montonio --name "Montonio sandbox" --config @montonio.json
```

## Orders

| command | what it does | endpoint |
|---|---|---|
| `norbix payments orders [--buyer <usr_…>] [--reference <ref>] [--status <s>]` | list the orders, newest first | `GET /orders` |
| `norbix payments order <id>` | show one order: lines, total, status, settled / refunded cents, checkout attempts | `GET /orders/{Id}` |
| `norbix payments order create --buyer <usr_…> --reference <ref> --key <key> --line <sku:qty:cents[:title]>... [--meta k=v]... [--currency EUR] [--price-version v1] [--file <json>]` | create an order for one buyer | `POST /orders` |
| `norbix payments order checkout <id> --integration <id> --return-url <url> [--method <m>] [--country <cc>] [--provider <code>]` | start or reuse the checkout; answers the payment URL | `POST /orders/{Id}/checkout` |

The price is yours: Norbix adds up the lines (whole cents, EUR — at least 1
cent per unit) and never reads a price from the buyer. Every line needs a title;
`--line` without one uses the sku. `--key` is the idempotency key: the same key with
the same body returns the same order, with another body it is refused (409).
Creating an order needs a key whose role has "Payments — full access" (or
Administrator); a buyer can read and check out only their own orders.
`--return-url` must be on one of the project's allowed origins. The return
page proves nothing — read the result with `payments order <id>` or react to
the order triggers below.

```bash
norbix payments order create --buyer usr_1szW… --reference ad-1042-promo-1 --key promo-1042-0001 --line star-day:21:30 --meta adId=ad_1042
norbix payments order checkout ord_2ToI… --integration int_6KfK… --return-url https://shop.example.com/paid
norbix payments order ord_2ToI…
```

## Triggers

| command | what it does | endpoint |
|---|---|---|
| `norbix payments triggers` | list the payment triggers | `GET /triggers` |
| `norbix payments trigger <id>` | show one trigger | `GET /triggers/{id}` |
| `norbix payments trigger save --file <json> [--when <type>] [--id <id>] [--event <name>]... [--integration <id>]... [--order <n>] [--[no-]break-on-error]` | create or update a trigger | `POST /triggers` |
| `norbix payments trigger enable <id>` | turn it on | `PATCH /triggers/{triggerId}/enable` |
| `norbix payments trigger disable <id> [--yes]` | turn it off | `PATCH /triggers/{triggerId}/disable` |
| `norbix payments trigger delete <id> [--yes]` | delete it | `DELETE /triggers/{triggerId}` |

The `--file` holds the trigger — the same shape `payments trigger <id> --json`
shows. `type` (`Payments`) is filled in, and `when` defaults to
`OnWebhookCallReceived` when the file leaves it out; `--when` overrides it:

- `OnWebhookCallReceived` — a provider webhook reached Norbix.
- `OnOrderPaid` — a verified callback made a stored order Paid.
- `OnOrderPaymentChanged` — a stored order was paid, refunded, reversed or
  expired. (`OnOrderCreated` is refused: nothing fires it.)

- `events` — for `OnWebhookCallReceived` the provider's own event names, e.g.
  `payment_intent.succeeded` or `charge.refunded`; for the order types
  `payments.order.paid`, `payments.order.partially_refunded`,
  `payments.order.refunded`, `payments.order.reversed`, `payments.order.expired`.
  Empty = every event. A name the server does not know is refused.
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

An order trigger runs once per change of a stored order, from the order as
stored (never from the callback body). Templates read `@Model.Order.*`
(`Order.Id`, `Order.Status`, `Order.Total`, `Order.MerchantReference`,
`Order.Metadata.<key>`, …) next to `@Model.Payment.*`; a function gets
`data.order` (and `data.payment`); a `WebhookCall` sends
`payments.order.paid` (or the other order event) with the order event as its
data. De-duplicate on `orderEventId` — it is the same on every retry.

```bash
norbix payments trigger save --file order-paid.json --when OnOrderPaid
norbix payments trigger save --file refunds.json --when OnOrderPaymentChanged --event payments.order.refunded
```

## Not offered on purpose

- The inbound webhook (`POST /payments/webhooks/{accountId}/…`) — the payment
  provider calls it, not a person.
- Payment schemas, customers, plans and discounts — not live in this phase.
- Production charging through Montonio — sandbox only until the owner turns it on.
