# `norbix push`

Manage push notifications from the terminal. Every command below is covered by
`tests/push.test.ts` or `tests/push-existing.test.ts`.

## Module

| command | what it does | endpoint |
|---|---|---|
| `norbix push settings [--id <id>]` | show the project push settings | `GET /notifications/push/settings` |

## Integrations

| command | what it does | endpoint |
|---|---|---|
| `norbix push integrations [--page-size <n>] [--after <cursor>]` | list the integrations | `GET /notifications/push/integrations` |
| `norbix push integration <id>` | show one integration | `GET /notifications/push/integrations/{id}` |
| `norbix push integration enable <id>` | turn it on | `PUT /notifications/push/integrations/{Id}/enable` |
| `norbix push integration disable <id>` | turn it off | `PUT /notifications/push/integrations/{Id}/disable` |
| `norbix push integration default <id>` | make it the project default | `PUT /notifications/push/integrations/{Id}/default` |
| `norbix push integration delete <id> [--yes]` | delete it | `DELETE /notifications/push/integrations/{Id}` |
| `norbix push integration test --integration <id> [--token <t>] [--family <f>]` | send a test push | `POST /notifications/push/integrations/test` |

While you are developing, point `integration test` at the **Fake** integration.
It accepts the send and contacts no push service, so nothing reaches a real
device.

```bash
norbix push integrations
norbix push integration test --integration int_123 --token dGVzdA== --family Ios
```

## Devices

| command | what it does | endpoint |
|---|---|---|
| `norbix push device register --user <id> --token <t> --os <os>` | register a device for a user | `POST /notifications/push/devices` |

A device always belongs to a user, so `--user` is required. `--os` is the
operating system the token came from; the backend uses it to pick a provider.

```bash
norbix push device register --user usr_123 --token dGVzdA== --os iOS --model "iPhone 15"
```

## Templates

| command | what it does | endpoint |
|---|---|---|
| `norbix push templates [--archived]` | list templates | `GET /notifications/push/templates` |
| `norbix push template <id>` | show one template | `GET /notifications/push/templates/{id}` |
| `norbix push archive <id>` | archive a template | `PUT /notifications/push/templates/{Id}/archive` |
| `norbix push unarchive <id>` | restore an archived template | `PUT /notifications/push/templates/{Id}/unarchive` |
| `norbix push clone <id>` | copy a template | `POST /notifications/push/templates/{Id}/clone` |
| `norbix push delete <id> [--yes]` | delete a template | `DELETE /notifications/push/templates/{Id}` |

## Campaigns

| command | what it does | endpoint |
|---|---|---|
| `norbix push campaigns [--page-size <n>] [--after <cursor>]` | list campaigns | `GET /notifications/push/campaigns` |
| `norbix push campaign <id>` | show a campaign | `GET /notifications/push/campaigns/{id}` |
| `norbix push campaign <id> --stats` | show its delivery statistics instead | `GET /notifications/push/campaigns/{id}/stats` |
| `norbix push preview <hash>` | render the title, body and subtitle behind a preview link | `GET /notifications/push/preview` |
| `norbix push stop <id> [--yes]` | stop a running campaign | `POST /notifications/push/campaigns/{Id}/stop` |

`push preview` takes the opaque hash the backend puts in a preview link — you
cannot build it yourself, so copy it out of the link.

`push stop` needs `stopPushCampaign`, which the published `@norbix.ai/ts` does
not have yet. Until the SDK is republished the command tells you so and prints
the `norbix api` call to use instead.

## Not covered yet

These push endpoints have no command. Anything with an SDK method is still
reachable through `norbix api`:

| endpoint | why there is no command |
|---|---|
| `GET /push/enable`, `GET /push/disable` | turning a whole module on or off is a console action, not a scripting one |
| `GET /push/disable-dependencies` | no SDK method in the published client |
| `POST`/`PUT /push/templates`, `POST /push/templates/render`, `GET /push/templates/{id}/tokens` | authoring a template means editing multilingual content, which does not fit flags |
| `POST /push/campaigns` | needs a whole audience object; see the SDK docs |
| `POST /push/integrations` | needs a provider-specific credential object |
| `GET /push/campaigns/{id}/batches` and the batch / message reads | reporting views, better served by the console |
| `POST /push/integrations/confirm-human-delivery`, `POST /push/integrations/app/request` | part of the managed-app flow, which is console-driven |

Tracked as **cli-push-remaining-commands**.
