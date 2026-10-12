# `norbix code`

The cloud-function half of the Code module from the terminal: the functions a
[Code integration](https://docs.norbix.ai/cloud/code/integrations) may call,
their aliases and versions, a call by hand, a sample envelope for a local run,
and the last runs of a trigger or a scheduled task. The integration itself
(credentials for AWS Lambda, Azure Functions or Google Cloud Functions) is
managed with `norbix integrations code` and `norbix hub code …`.

Every command is covered by `tests/code-routes.test.ts`, which runs it through
the real SDK with `fetch` replaced and checks the verb, path, query and — for
`invoke` — the exact JSON body it sends. No test calls a provider.

All paths below are under `/{version}/code/functions`. They need `code:read` on
the integration (`code:execute` for `invoke`).

| command | what it prints | endpoint |
|---|---|---|
| `norbix code functions --integration <int_…> [--prefix <text>] [--tag <key>\|<key=value>] [--page-size <n>] [--after <cursor>]` | one row per function: id, display name, runtime, region, last modified, tags — read live from the provider; Azure integrations have no list | `GET /` |
| `norbix code qualifiers --integration <int_…> --function <id>` | the aliases and versions: name, kind (Alias / Version), the version an alias points at | `GET /qualifiers` |
| `norbix code invoke --integration <int_…> --function <id> [--qualifier <alias\|version>] [--payload '<json>' \| --payload-file <file>] [--async] [--run-as <usr_…>] [--config '<json>'] [--dry-run]` | Sync (default): the status code, the duration in ms, the function's output and the provider's request id. `--async`: that the call was accepted | `POST /invoke` |
| `norbix code event-sample --source <database\|membership\|files\|payments\|ai\|scheduler\|manual> [--event <name>] [--schema <sch_…>]` | the full envelope with sample data — the fixture for `sam local invoke`, `func start` or the Functions Framework | `GET /event-sample` |
| `norbix code runs --trigger <trg_…> \| --task <tsk_…> [--limit <1-50>]` | the last runs, newest first: fired at, event, succeeded, status code, duration, error, request id | `GET /runs` |

`--json` on any of them prints the raw answer. `invoke` sends the function a
`manual.invoke` envelope with the payload in `data.payload`; `context.runAs` is
you unless `--run-as` names a service user. `--payload` takes inline JSON,
`@file` or `-` (stdin); `--payload-file` a file path. `event-sample` prints the
envelope alone (not the response wrapper), so `> event.json` is a fixture a
local runner takes as-is.

```sh
norbix code functions --integration int_6rBACnEaxQ0x1jTiHtAuWV --prefix orders- --tag norbix=bookshop
norbix code qualifiers --integration int_6rBACnEaxQ0x1jTiHtAuWV --function orders-on-update
norbix code invoke --integration int_6rBACnEaxQ0x1jTiHtAuWV --function orders-on-update --qualifier prod \
  --payload '{"orderId":"6ac54a59212c29912eaddd81","dryRun":true}'
norbix code invoke --integration int_6rBACnEaxQ0x1jTiHtAuWV --function orders-nightly-payouts --payload-file payload.json --async
norbix code event-sample --source database --event database.record.updated --schema sch_7lPCzWonEvTQsheGDCaKq > event.json
norbix code runs --trigger trg_1p4R3gTobGZpD6fXvHT4rd --limit 10
```

The envelope your function receives and the SDK helper that parses it
(`parseFunctionEvent` in `@norbix.ai/ts`): [Cloud functions](https://docs.norbix.ai/cloud/concepts/code-functions).
