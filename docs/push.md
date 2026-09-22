# `norbix push`

Manage push notifications from the terminal. Every push endpoint has a command.

Every command is covered by `tests/push-routes.test.ts`, which runs it through
the real SDK with `fetch` replaced and checks the verb and path it sends (so a
wrong route token fails a test). `tests/push.test.ts` and
`tests/push-existing.test.ts` also check the request fields. No test contacts a
push provider; the only provider a test saves is **Fake**.

All paths below are under `/{version}/notifications/push`.

## Module

| command | what it does | endpoint |
|---|---|---|
| `norbix push enable` | turn the push module on | `GET /enable` |
| `norbix push disable [--yes]` | turn the push module off | `GET /disable` |
| `norbix push disable-dependencies` | list what still depends on push — check before `disable` | `GET /disable-dependencies` |
| `norbix push settings [--id <id>]` | show the project push settings | `GET /settings` |

## Integrations

| command | what it does | endpoint |
|---|---|---|
| `norbix push integrations [--page-size <n>] [--after <cursor>]` | list the integrations | `GET /integrations` |
| `norbix push integration <id>` | show one integration | `GET /integrations/{id}` |
| `norbix push integration save --provider <p> [--name <n>] [--id <id>] [--disabled] [--config <json>]` | create or update an integration | `POST /integrations` |
| `norbix push integration enable <id>` | turn it on | `PUT /integrations/{Id}/enable` |
| `norbix push integration disable <id>` | turn it off | `PUT /integrations/{Id}/disable` |
| `norbix push integration default <id>` | make it the project default | `PUT /integrations/{Id}/default` |
| `norbix push integration delete <id> [--yes]` | delete it | `DELETE /integrations/{Id}` |
| `norbix push integration test --integration <id> [--token <t>] [--family <f>]` | send a test push | `POST /integrations/test` |
| `norbix push integration confirm-delivery <id>` | confirm the test push reached a person | `POST /integrations/confirm-human-delivery` |
| `norbix push integration app-request --user <id> --request-id <id> --pin <n> --valid-till <date> --public-key <key>` | register a Norbix app pairing request (account-scoped) | `POST /integrations/app/request` |

`--provider` is one of `Fake`, `AppleApns`, `AndroidFirebase`, `SafariPush`,
`ChromeWeb`, `FirefoxWeb`, `EdgeWeb`, `ChromePush`. **Fake** needs nothing else:
it accepts every send and contacts no push service, so nothing reaches a real
device — use it while you develop. The real providers need their credentials:
put the provider-specific fields in `--config` as a JSON object (inline,
`@file.json`, or `-` for stdin).

```bash
norbix push integration save --provider Fake
norbix push integration save --provider AndroidFirebase --name Android --config @firebase.json
norbix push integration test --integration int_123 --token dGVzdA== --family Ios
norbix push integration confirm-delivery int_123
```

`app-request` is part of the managed-app pairing flow (the Norbix mobile app
shows the request ID, PIN and public key). It needs an account ID — configure
one or pass `--account`.

## Devices

| command | what it does | endpoint |
|---|---|---|
| `norbix push device register --user <id> --token <t> --os <os>` | register a device for a user | `POST /devices` |
| `norbix push devices` | list the registered devices | `GET /devices` |
| `norbix push device <id>` | show one device and its owner | `GET /devices/{id}` |

A device always belongs to a user, so `--user` is required on register. `--os`
is the operating system the token came from; the backend uses it to pick a
provider.

```bash
norbix push device register --user usr_123 --token dGVzdA== --os iOS --model "iPhone 15"
```

`push devices` narrows with `--user`, `--token` (the provider token) and
`--platform` (`ios`, `android`, `chrome`, `safari`, `expo`); a word outside
that list is refused rather than answered with an empty list.

```bash
norbix push devices --platform ios
norbix push device pnd_123
```

Devices are stored inside their user, so a page is a page of **users** and
carries every matching device those users hold. Follow `hasMore` rather than
stopping at the first short page.

## Templates

| command | what it does | endpoint |
|---|---|---|
| `norbix push templates [--archived]` | list templates | `GET /templates` |
| `norbix push template <id>` | show one template | `GET /templates/{id}` |
| `norbix push template create --name <n> (--title <t> --body <b> \| --translations <json>)` | create a template | `POST /templates` |
| `norbix push template update <id> --name <n> (--title <t> --body <b> \| --translations <json>)` | replace a template | `PUT /templates` |
| `norbix push template tokens <id>` | list the tokens the template uses | `GET /templates/{id}/tokens` |
| `norbix push template render --code <razor> [--token key=value]... [--preview]` | render one field with token values | `POST /templates/render` |
| `norbix push archive <id>` | archive a template | `PUT /templates/{Id}/archive` |
| `norbix push unarchive <id>` | restore an archived template | `PUT /templates/{Id}/unarchive` |
| `norbix push clone <id>` | copy a template | `POST /templates/{Id}/clone` |
| `norbix push delete <id> [--yes]` | delete a template | `DELETE /templates/{Id}` |

`create` and `update` also take `--description`, `--channel`
(`Transactional` · `Marketing` · `System`, default `Transactional`) and `--tag`
(repeat for several). For one language use `--title` and `--body` (plus
`--language`, default `en`). For several, pass `--translations` with a JSON
array of `{"language": "en", "content": {"title": "…", "body": "…"}}` (inline,
`@file.json`, or `-`). `update` sends the whole template, so include every
language you want to keep.

```bash
norbix push template create --name Welcome --title "Hi @Model.Name" --body "Thanks for joining"
norbix push template tokens tpl_123
norbix push template render --code "Hi @Model.Name" --token Name=Ada
```

## Campaigns

| command | what it does | endpoint |
|---|---|---|
| `norbix push campaigns [--page-size <n>] [--after <cursor>]` | list campaigns | `GET /campaigns` |
| `norbix push campaign <id>` | show a campaign | `GET /campaigns/{id}` |
| `norbix push campaign <id> --stats` | show its delivery statistics instead | `GET /campaigns/{id}/stats` |
| `norbix push campaign create --template <id> --audience <a> …` | create (and send or schedule) a campaign | `POST /campaigns` |
| `norbix push campaign delete <id> [--yes]` | delete a campaign | `DELETE /campaigns/{Id}` |
| `norbix push stop <id> [--yes]` | stop a running campaign | `POST /campaigns/{Id}/stop` |
| `norbix push campaign batches <id>` | list its send batches | `GET /campaigns/{id}/batches` |
| `norbix push campaign batch <id> <batchId>` | list the notifications in a batch | `GET /campaigns/{id}/batches/{batchId}` |
| `norbix push campaign batch <id> <batchId> <notificationId>` | show one notification in a batch | `GET /campaigns/{id}/batches/{batchId}/{notificationId}` |
| `norbix push campaign messages <id> [--batch <batchId>]` | list the messages it sent | `GET /campaigns/{campaignId}/messages` |
| `norbix push campaign message <id> <messageId> --batch <batchId>` | show one message | `GET /campaigns/{campaignId}/messages/{id}` |
| `norbix push preview <hash>` | render the title, body and subtitle behind a preview link | `GET /preview` |

`--audience` decides who receives the campaign:

| `--audience` | recipients | flags |
|---|---|---|
| `all-users` | every user | narrow with `--role`, `--tag` |
| `users` | the named users | `--user` (repeat) |
| `account-users` | the named account users | `--user` (repeat) |
| `collection` | users referenced by a field in a collection | `--schema`, `--field` (repeat), `--field-type User\|Email`, `--role` |
| `devices` | raw device tokens | `--device <token>:<family>` (repeat; family is `Ios`, `Android`, `Chrome`, `Safari` or `Expo`) |

Other `create` flags: `--integration` (default: the project default
integration), `--language`, `--notes`, `--at` (send later — ISO 8601 date-time
or Unix seconds; without it the campaign is sent right away), `--token
key=value` (repeat), `--database-integration`, and `--config` for any other
campaign field as a JSON object.

```bash
norbix push campaign create --template tpl_123 --audience all-users --tag beta
norbix push campaign create --template tpl_123 --audience devices --device dGVzdA==:Ios --at 2026-10-01T09:00:00Z
norbix push campaign batches cmp_123
```

`push preview` takes the opaque hash the backend puts in a preview link — you
cannot build it yourself, so copy it out of the link.

## Known backend gaps

These commands send the right request, but the backend cannot serve it yet
(tracked in the push campaign's `issues.md`):

- `push campaign delete` — **P2h**: the server's request type has no bindable
  `Id`, so no campaign can be deleted.
- `push device register` — **P2g**: the Hub does not register the device
  command, so no device can be registered.
- `push campaign message` — the route has an `{id}` token but the server's
  request type has no `Id` field; it reads `notificationId`, so the command
  sends the message ID as both.
