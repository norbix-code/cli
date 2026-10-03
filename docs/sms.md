# `norbix sms`

Manage SMS from the terminal. Every SMS endpoint has a command.

Every command is covered by `tests/sms-routes.test.ts`, which runs it through
the real SDK with `fetch` replaced and checks the verb and path it sends (so a
wrong route token fails a test). `tests/sms.test.ts` and
`tests/sms-existing.test.ts` also check the request fields. No test contacts an
SMS provider; the only provider a test saves is **Fake**.

All paths below are under `/{version}/notifications/sms`.

## Module

| command | what it does | endpoint |
|---|---|---|
| `norbix sms enable` | turn the SMS module on | `GET /enable` |
| `norbix sms disable [--yes]` | turn the SMS module off | `GET /disable` |
| `norbix sms disable-dependencies` | list what still depends on SMS — check before `disable` | `GET /disable-dependencies` |
| `norbix sms settings [--id <id>]` | show the project SMS settings | `GET /settings` |

`norbix module enable sms` / `norbix module disable sms` do the same as the
first two, for scripts that treat every module alike.

## Integrations

| command | what it does | endpoint |
|---|---|---|
| `norbix sms integrations [--page-size <n>] [--after <cursor>]` | list the integrations | `GET /integrations` |
| `norbix sms integration <id>` | show one integration | `GET /integrations/{id}` |
| `norbix sms integration save --provider <p> [--name <n>] [--id <id>] [--disabled] [--config <json>]` | create or update an integration | `POST /integrations` |
| `norbix sms integration enable <id>` | turn it on | `PUT /integrations/{Id}/enable` |
| `norbix sms integration disable <id>` | turn it off | `PUT /integrations/{Id}/disable` |
| `norbix sms integration default <id>` | make it the project default | `PUT /integrations/{Id}/default` |
| `norbix sms integration delete <id> [--yes]` | delete it | `DELETE /integrations/{Id}` |
| `norbix sms integration test --integration <id> [--to <phone>]` | send a test SMS | `POST /integrations/test` |
| `norbix sms integration confirm-delivery <id>` | confirm the test SMS reached a person | `POST /integrations/confirm-human-delivery` |

`--provider` is one of `Fake`, `Twilio`, `Vonage`, `Plivo`, `Telnyx`, `Bird`,
`Telesign`, `Sinch`. **Fake** needs nothing else: it accepts every send and
contacts no SMS service, so nothing reaches a real phone — use it while you
develop. A project can hold one Fake and it has no update path: delete it and
add it again. The real providers need their credentials: put the
provider-specific fields in `--config` as a JSON object (inline, `@file.json`,
or `-` for stdin).

```bash
norbix sms integration save --provider Fake
norbix sms integration save --provider Twilio --name Twilio --config @twilio.json
norbix sms integration test --integration int_123 --to +37060000000
norbix sms integration confirm-delivery int_123
```

## Templates

| command | what it does | endpoint |
|---|---|---|
| `norbix sms templates [--archived]` | list templates | `GET /templates` |
| `norbix sms template <id>` | show one template | `GET /templates/{id}` |
| `norbix sms template create --name <n> (--body <b> [--subject <s>] \| --translations <json>)` | create a template | `POST /templates` |
| `norbix sms template update <id> --name <n> (--body <b> [--subject <s>] \| --translations <json>)` | replace a template | `PUT /templates` |
| `norbix sms template tokens <id>` | list the tokens the template uses | `GET /templates/{id}/tokens` |
| `norbix sms template render --code <razor> [--token key=value]... [--preview]` | render text with token values | `POST /templates/render` |
| `norbix sms archive <id>` | archive a template | `PUT /templates/{Id}/archive` |
| `norbix sms unarchive <id>` | restore an archived template | `PUT /templates/{Id}/unarchive` |
| `norbix sms clone <id>` | copy a template | `POST /templates/{Id}/clone` |
| `norbix sms delete <id> [--yes]` | delete a template | `DELETE /templates/{Id}` |

`create` and `update` also take `--description`, `--channel`
(`Transactional` · `Marketing` · `System`, default `Transactional`) and `--tag`
(repeat for several). For one language use `--body` (plus `--language`,
default `en`, and `--subject` — the sender id, empty by default, as in the
portal). For several, pass `--translations` with a JSON array of
`{"language": "en", "content": {"subject": "", "body": "…"}}` (inline,
`@file.json`, or `-`). `update` sends the whole template, so include every
language you want to keep. Tokens are Razor: `@Model.Name`, not `{{Name}}`.

```bash
norbix sms template create --name Welcome --body "Hi @Model.Name, your code is @Model.Code"
norbix sms template tokens tpl_123
norbix sms template render --code "Hi @Model.Name" --token Name=Ada
```

## Campaigns

| command | what it does | endpoint |
|---|---|---|
| `norbix sms campaigns [--page-size <n>] [--after <cursor>]` | list campaigns | `GET /campaigns` |
| `norbix sms campaign <id>` | show a campaign | `GET /campaigns/{id}` |
| `norbix sms campaign <id> --stats` | show its delivery statistics instead | `GET /campaigns/{id}/stats` |
| `norbix sms campaign create --template <id> --audience <a> …` | create (and send or schedule) a campaign | `POST /campaigns` |
| `norbix sms campaign delete <id> [--yes]` | delete a campaign | `DELETE /campaigns/{id}` |
| `norbix sms stop <id> [--yes]` | stop a running campaign | `POST /campaigns/{Id}/stop` |
| `norbix sms campaign batches <id>` | list its send batches | `GET /campaigns/{id}/batches` |
| `norbix sms campaign batch <id> <batchId>` | list the notifications in a batch | `GET /campaigns/{id}/batches/{batchId}` |
| `norbix sms campaign batch <id> <batchId> <notificationId>` | show one notification in a batch | `GET /campaigns/{id}/batches/{batchId}/{notificationId}` |
| `norbix sms campaign messages <id> [--batch <batchId>]` | list the messages it sent | `GET /campaigns/{campaignId}/messages` |
| `norbix sms campaign message <id> <messageId> --batch <batchId>` | show one message | `GET /campaigns/{campaignId}/messages/{notificationId}` |
| `norbix sms preview <hash>` (or `--hash <hash>`) | render the text behind a preview link | `GET /preview` |

`--audience` decides who receives the campaign:

| `--audience` | recipients | flags |
|---|---|---|
| `all-users` | every user with a phone number | narrow with `--role`, `--tag` |
| `users` | the named users | `--user` (repeat) |
| `collection` | records of a collection whose field holds the recipient | `--schema`, `--field` (repeat), `--field-type User\|Email`, `--role` |
| `phone-numbers` | raw phone numbers in international format | `--phone` (repeat) |

Other `create` flags: `--language`, `--at` (send later — ISO 8601 date-time
or Unix seconds; without it the campaign is sent right away),
`--respect-time-zone last-login|registration|registration-project` (send
`--at` in each recipient's own time zone), `--token key=value` (repeat),
`--database-integration`, and `--config` for any other delivery-settings
field as a JSON object. The integration is the project default one.

```bash
norbix sms campaign create --template tpl_123 --audience all-users --tag beta
norbix sms campaign create --template tpl_123 --audience phone-numbers --phone +37060000000 --at 2026-10-01T09:00:00Z
norbix sms campaign batches cmp_123
```

`sms preview` takes the opaque hash the backend puts in a preview link — you
cannot build it yourself, so copy it out of the link.

The signed link is the key: `sms preview` needs **no login and no project**
(the default endpoints still need `--region`). When you are logged in, your
session is still sent. A `401` means the link is invalid or expired.

```sh
norbix sms preview --hash 8f2a91c4... --region nb-eu-germany
```

## Not offered on purpose

- **`--audience account-users`**: the gateway's audience enum lists
  `AccountUsers`, but the Sms campaign request has no settings block for it,
  so the server would refuse the campaign. Push has it; SMS does not yet.
- **Choosing the integration per campaign**: the Sms campaign request has no
  integration field — the project default integration sends every campaign
  (`sms integration default <id>` picks it).
