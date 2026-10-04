# `norbix scheduler`

Manage scheduler tasks from the terminal. A task runs on a cron and, each time
it fires, sends an email campaign. Every Scheduler endpoint has a command.

Every command is covered by `tests/scheduler-routes.test.ts`, which runs it
through the real SDK with `fetch` replaced and checks the verb, path, query and
— for `save` — the exact JSON body it sends. No test sends an e-mail.

All paths below are under `/{version}/scheduler`.

## Module

| command | what it does | endpoint |
|---|---|---|
| `norbix module enable scheduler` | turn the scheduler module on | `PUT /enable` |
| `norbix module disable scheduler [--yes]` | turn it off: every task stops firing (the tasks are kept) | `PUT /disable` |

The gateway answers these two routes on **PUT** only. The CLI sends PUT from
version 1.9.1 on (it uses `@norbix.ai/ts` 4.6.0); older CLI versions send GET,
which the gateway refuses — update the CLI.

## Tasks

| command | what it does | endpoint |
|---|---|---|
| `norbix scheduler list [--type <type>] [--enabled \| --no-enabled] [--page-size <n>] [--after <cursor>]` | list the tasks | `GET /tasks` |
| `norbix scheduler get <id>` | show one task | `GET /tasks/{id}` |
| `norbix scheduler save --name <n> --cron <cron> --initiator <usr_…> --template <id> --audience <a> [--id <id>] [...]` | create a task, or update it with `--id` | `POST /tasks` |
| `norbix scheduler enable <id> [--yes]` | switch it on — it fires on its next cron tick | `PUT /tasks/{Id}/enable` |
| `norbix scheduler disable <id> [--yes]` | switch it off | `PUT /tasks/{Id}/disable` |
| `norbix scheduler delete <id> [--yes]` | delete it | `DELETE /tasks/{Id}` |

`save`, `enable`, `disable` and `delete` change what the project sends, so they
ask first: in a script or an agent pass `--yes`, and preview with `--dry-run`
(prints the request, sends nothing).

`list --type` is one of `EmailCampaign`, `PushCampaign`, `SmsCampaign`,
`CodeFunctionalCall`, `WebhookCall`; `--enabled` shows only enabled tasks,
`--no-enabled` only disabled ones, neither shows both.

## Saving a task

```bash
# Every Monday at 09:00 UTC, send template tpl_123 to every user tagged "beta".
norbix scheduler save --name "Weekly digest" --cron "0 9 * * 1" \
  --initiator usr_123 --template tpl_123 --audience all-users --tag beta --yes

# Change it: the same command with --id, every field again.
norbix scheduler save --id tsk_456 --name "Weekly digest" --cron "0 10 * * 1" \
  --initiator usr_123 --template tpl_123 --audience all-users --tag beta --yes

# Save it switched off, then turn it on later.
norbix scheduler save --name "Launch mail" --cron "0 8 1 * *" --initiator usr_123 \
  --template tpl_123 --audience emails --email ada@example.com --no-enabled --yes
norbix scheduler enable tsk_789 --yes
```

The first command sends:

```json
{
  "name": "Weekly digest",
  "cron": "0 9 * * 1",
  "initiatorUserId": "usr_123",
  "isEnabled": true,
  "stopOnError": false,
  "task": {
    "type": "EmailCampaign",
    "campaign": {"source": "AllUsers", "templateId": "tpl_123", "userTags": ["beta"]}
  }
}
```

and prints `Task <id> saved.` (`--json` prints `{"id": "<id>"}`).

Good to know:

- **Only email campaigns** can be scheduled today (`task.type` is always
  `EmailCampaign`). The other task types exist in the list filter but the
  gateway does not save them.
- **`--cron` has 5 fields** — minute, hour, day of month, month, day of week —
  and runs in **UTC**. The CLI checks the field count before it sends anything;
  the gateway checks the rest. Quote it: `--cron "0 9 * * 1"`.
- **`--initiator`** is the user the task runs as: yourself (`norbix whoami`) or
  a service user of this project. It must belong to the project.
- **`--id` replaces the task**: send every flag again — a flag you leave out is
  not kept from the stored task.
- **`--enabled` is the default**; `--no-enabled` saves the task switched off.
  `--stop-on-error` switches the task off after a run fails.
- **The campaign flags** are the ones of `norbix email campaign create`
  (see [email.md](email.md)): `--audience all-users | users | account-users |
  emails | collection` with `--role`, `--tag`, `--user`, `--email`, `--cc`,
  `--bcc`, `--one-each`, `--schema`, `--field`, `--field-type`, plus
  `--integration`, `--validation-integration`, `--language`, `--notes`,
  `--token key=value`. There is no `--at`: the cron decides when it sends.
- **`--database-integration`** goes on the task (`task.databaseIntegrationId`);
  without it the project default is used when the task fires.
- **`--config`** (a JSON object, `@file.json`, or `-` for stdin) is merged into
  `task.campaign` for any field the flags do not cover; a flag you pass wins
  over the same key in `--config`.
