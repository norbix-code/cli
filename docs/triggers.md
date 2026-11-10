# Triggers from the terminal

A trigger runs an action when something happens in a module: a record changes
(`db trigger`, [docs/database.md](database.md#schema-triggers)), a payment
arrives (`payments trigger`, [docs/payments.md](payments.md#triggers)), a file
is stored or removed (`files trigger`), a user registers or changes
(`membership trigger`), the project's AI credits or a user's AI quota run low
(`ai trigger`). Every host has the same six commands; the `norbix trigger …`
commands at the end work on a trigger of any host.

## The file every `save` takes

```json
{
  "name": "Invoice stored",
  "when": "OnFileUploaded",
  "folder": "invoices",
  "action": {"type": "Email", "integrationId": "int_mail", "templateId": "tpl_invoice"},
  "preExecuteCode": "return New.size < 10000000;"
}
```

- `type` (`Files`, `Membership`, `Ai`) is filled in by the command; `when`
  must be in the file or given with `--when` (the values are per host, below).
- `action` is what to run. The portal's trigger page builds the message
  actions; the two code actions are simple enough to write by hand:

  ```json
  {"type": "Code", "functionRef": {"integrationId": "int_lambda", "functionId": "notify-sales", "qualifier": "live"}, "invocationType": "Async"}
  ```

  runs a cloud function through a Code integration (`norbix code functions`
  lists what an integration may call; `invocationType` `Sync` waits for the
  result, `Async` fires and forgets), and

  ```json
  {"type": "Workflow", "workflowRef": "wf_onboard", "payload": {"source": "cli"}}
  ```

  starts a workflow (`norbix code workflows`), with `payload` as its
  `@Model.Request.*` values. The other types: `Email`, `Sms`, `Push`
  (an integration and a template), `WebhookCall`, `SseCall`, `Marketplace`.
- A file that holds the whole request (`{"trigger": {…}}`), a `<host> trigger
  <id> --json` answer or a `norbix trigger definition … --json` answer works
  too: read → edit → save with `--id`.
- `--id` updates instead of creating (an update replaces the whole trigger),
  `--execution-identity` says who the action runs as (`norbix
  identities list`; leave it out for the project default). Check an identity
  first with `norbix trigger identity-check`.

## Files triggers

| command | what it does | endpoint |
|---|---|---|
| `norbix files triggers` | list the files triggers | `GET /files/triggers` |
| `norbix files trigger <id>` | show one trigger | `GET /files/triggers/{id}` |
| `norbix files trigger save --file <json> [--when <event>] [--folder <path>] [--id <id>] [--execution-identity <usr>]` | create or update a trigger | `POST /files/triggers` |
| `norbix files trigger enable <id>` | turn it on | `PATCH /files/triggers/{triggerId}/enable` |
| `norbix files trigger disable <id> [--yes]` | turn it off | `PATCH /files/triggers/{triggerId}/disable` |
| `norbix files trigger delete <id> [--yes]` | delete it | `DELETE /files/triggers/{triggerId}` |

`when`: `OnFileUploaded` (a file was stored) or `OnFileDeleted`. `folder`
narrows the trigger to one folder and its subfolders (`invoices`,
`invoices/2026`); empty = every file of the project. Templates read the file
as `@Model.File.*`; a function gets it as `data.file`.

```bash
norbix files trigger save --file invoice-stored.json --when OnFileUploaded --folder invoices
norbix files trigger save --file code-action.json --execution-identity usr_66b2f0a1
norbix files trigger disable trg_123 --yes
```

## Membership triggers

| command | what it does | endpoint |
|---|---|---|
| `norbix membership triggers` | list the membership triggers | `GET /membership/triggers` |
| `norbix membership trigger <id>` | show one trigger | `GET /membership/triggers/{id}` |
| `norbix membership trigger save --file <json> [--when <event>] [--id <id>] [--execution-identity <usr>]` | create or update a trigger | `POST /membership/triggers` |
| `norbix membership trigger enable <id>` | turn it on | `PATCH /membership/triggers/{triggerId}/enable` |
| `norbix membership trigger disable <id> [--yes]` | turn it off | `PATCH /membership/triggers/{triggerId}/disable` |
| `norbix membership trigger delete <id> [--yes]` | delete it | `DELETE /membership/triggers/{triggerId}` |

`when`: `OnRegistered` (a login was created), `OnInvited`, `OnVerified`,
`OnUpdated`, `OnDeleted`, `OnBlocked`, `OnReactivated`, `OnUserCreated` (a
person was created — the user, not the credential). A message action may go to
the person the event is about: `"deliverySettings": {"recipientsSourceType":
"TriggerSubject"}` on an `Email`, `Sms` or `Push` action (membership triggers
only).

```bash
norbix membership trigger save --file welcome.json --when OnRegistered
norbix membership trigger save --file workflow-action.json
norbix membership trigger delete trg_123 --yes
```

## AI triggers

AI triggers have no portal screen: the CLI and the SDKs set them up.

| command | what it does | endpoint |
|---|---|---|
| `norbix ai triggers` | list the AI triggers | `GET /ai/triggers` |
| `norbix ai trigger <id>` | show one trigger | `GET /ai/triggers/{id}` |
| `norbix ai trigger save --file <json> [--when <event>] [--id <id>] [--execution-identity <usr>]` | create or update a trigger | `POST /ai/triggers` |
| `norbix ai trigger enable <id>` | turn it on | `PATCH /ai/triggers/{triggerId}/enable` |
| `norbix ai trigger disable <id> [--yes]` | turn it off | `PATCH /ai/triggers/{triggerId}/disable` |
| `norbix ai trigger delete <id> [--yes]` | delete it | `DELETE /ai/triggers/{triggerId}` |

`when`: `OnCreditsWarning`, `OnCreditsExhausted` (the project's AI credits),
`OnQuotaWarning`, `OnQuotaExhausted` (a user's AI plan quota).

```bash
norbix ai trigger save --file credits.json --when OnCreditsExhausted
norbix ai trigger enable trg_123
```

## Any host: runs, attention, definition, code test, identity check

| command | what it does | endpoint |
|---|---|---|
| `norbix trigger runs <type> <id> [--status <s>] [--page-size <n>] [--after <run> \| --before <run>]` | one trigger's runs, newest first, kept 30 days | `GET /triggers/runs` |
| `norbix trigger run <run> [--type <type>]` | one run: result, reason, who it ran as, what it produced | `GET /triggers/runs/{Id}` |
| `norbix trigger attention <type>` | the triggers of one kind whose last run stopped before it acted, with the reason | `GET /triggers/attention` |
| `norbix trigger definition <id> --type <type> [--schema <id>]` | one trigger in the shape its `save` takes (read → change → save) | `GET /triggers/{id}/definition` |
| `norbix trigger pre-execute-test --type <type> (--code <c> \| --file <path>) [--new <json>] [--old <json>] [--event-kind <k>] [--event-name <n>]` | test a trigger's `preExecuteCode` against a sample record; nothing is saved | `POST /triggers/pre-execute-code/test` |
| `norbix trigger identity-check --type <type> --action <json> [--execution-identity <usr>]` | may this identity run this action, and what does it lack | `POST /triggers/execution-identity/check` |

`<type>` is `Schema`, `Membership`, `Files`, `Payments` or `Ai`. A Schema
trigger's definition also needs `--schema` (the collection it watches).

`preExecuteCode` is C# that ends in `return true;` (the trigger runs) or
`return false;`, reading the record after the change as `New` and before it
as `Old`: `--new` and `--old` are those records as JSON (inline, `@file` or
`-`); leave `--old` out for an insert and `--new` out for a delete.

```bash
norbix trigger attention Files
norbix trigger definition trg_123 --type Membership --json > welcome.json
norbix trigger pre-execute-test --type Schema --code 'return New.status == "published";' --new '{"status":"published"}'
norbix trigger identity-check --type Files --action '{"type":"Email","integrationId":"int_1","templateId":"tpl_1"}' --execution-identity usr_1
```
