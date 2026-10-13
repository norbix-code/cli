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
| `norbix code runs --trigger <trg_…> \| --task <tsk_…> [--limit <1-50>]` | the last runs, newest first: fired at, event, succeeded, status code, duration, error, request id — a run through the Fake provider also its `input`, the envelope the function received (`context.runAs.accessToken` masked, cut at 64 KB), pretty-printed under the row | `GET /runs` |

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

## `norbix code marketplace`

The marketplace from the terminal: browse the listings (connectors), enable one
as a **connection** (`int_…`), run its validation steps, add **functions**
(`func_…`) to it, call one by hand, and read the last runs of a trigger or task
that calls marketplace functions. Concepts and the full contract:
[Marketplace](https://docs.norbix.ai/cloud/code/marketplace).

Every command is covered by `tests/code-marketplace-routes.test.ts` (same seam
as above: the real SDK, `fetch` replaced; the verb, path, query and body are
checked). No test calls a vendor.

All paths below are under `/{version}/code/marketplace`.

| command | what it does | endpoint |
|---|---|---|
| `norbix code marketplace listings [--search <text>] [--tags <tag>]… [--category <Category>]… [--transport <Rest\|Mcp\|Code\|Internal\|Sdk>]… [--official]` | the catalog this host shows | `GET /listings` |
| `norbix code marketplace listings <ml_…>` | one listing in full: install form (config and secret fields), validation steps, functions with key, form kind, parameters and inputs | `GET /listings/{id}` |
| `norbix code marketplace connections list` | the project's connections in the current environment | `GET /integrations` |
| `norbix code marketplace connections get <int_…>` | one connection: listing, config, on/off, `lastValidationSteps` (never secrets) | `GET /integrations/{id}` |
| `norbix code marketplace connections enable --listing <ml_…> [--name <text>] [--config k=v]… [--secret k=v]… [--id <int_…>]` | enables the listing as a new connection and prints the minted id; `--id` saves an existing one again (no `--secret` keeps the stored secrets) | `POST /integrations` |
| `norbix code marketplace connections enable <int_…>` | turns a turned-off connection back on | `POST /integrations/{id}/enable` |
| `norbix code marketplace connections disable <int_…> [--yes]` | turns it off | `POST /integrations/{id}/disable` |
| `norbix code marketplace connections delete <int_…> [--yes]` | deletes it with its secrets and functions | `DELETE /integrations/{id}` |
| `norbix code marketplace connections validate <int_…>` | runs the listing's steps; prints each step (`ok` / `failed` / `skipped`, required or not, message) and whether functions can be added | `POST /integrations/{id}/test` |
| `norbix code marketplace connections tools <int_…>` | an MCP connection's tool catalog, stored at its last `validate`: a table of name, access (`read-only` / `writes` / `writes (destructive)`, from the server's own hints) and the first line of the description, then when it was listed and its hash; `--json` the full catalog with every tool's `inputSchema` (JSON Schema as text), `listedAt`, `catalogHash`, `truncated`. No catalog (never validated, not an MCP connection) → `CM-ERRORS-MARKETPLACE-020` | `GET /integrations/{id}/tools` |
| `norbix code marketplace connections sign-in <int_…> [--open]` | starts the OAuth sign-in of an MCP connection: prints the vendor's sign-in link (`authorizeUrl`, works once, until `expiresAt`) and the redirect URL the vendor app must allow; `--open` also opens the link in this machine's browser (never over SSH). The vendor sends the browser back to the gateway, which stores the tokens; then `connections get` shows `signedIn` | `POST /integrations/{id}/oauth/start` |
| `norbix code marketplace connections access <int_…>` | who may use the connection: one row per role (account and project roles) with the package it holds — Viewer, Functions only, Read-only, Full access or `—` — plus `+ Manage`, `+ Custom (<policy>)` and `(fixed)` for Root and Project Admin, the role id, a note when the safe default (Read-only for Projects Developer) was not applied, the packages, the tool / function counts and the tools reachable only through Full access; `--json` the whole matrix | `GET /integrations/{id}/access` |
| `norbix code marketplace connections access set <int_…> --role <role id> --package <None\|Viewer\|FunctionsOnly\|ReadOnly\|FullAccess> [--manage]` | gives the role one package (case and dashes ignored: `read-only`); without `--manage` the role loses Manage. Needs `membership:managePolicies` | `PUT /integrations/{id}/access/roles` |
| `norbix code marketplace connections access custom <int_…> --role <role id> [--from <package>] [--tool <name>]… [--function <func_…>]… [--manage] [--new-policy]` | a custom policy for the role: the `--from` package (default `None`) plus the ticked tools and functions; prints the policy id, created or updated, and how many roles hold it. `--new-policy` writes a new one for this role only when its custom policy is shared | `POST /integrations/{id}/access/roles/custom` |
| `norbix code marketplace connections secrets set <int_…> --secret k=v…` | replaces **all** stored secrets of the connection | `PUT /integrations/{id}/secrets` |
| `norbix code marketplace functions list --connection <int_…>` | the functions added to a connection | `GET /integrations/{id}/functions` |
| `norbix code marketplace functions get <func_…> --connection <int_…>` | one function: key, arguments, inputs, template, mappings | `GET /integrations/{id}/functions/{func}` |
| `norbix code marketplace functions add --connection <int_…> --key <key> [--name <text>] [--arguments '<json>'] [--arg k=v]… [--input name[:type[:required]]]…` | adds a function and prints the minted id | `POST /integrations/{id}/functions` |
| `norbix code marketplace functions enable\|disable\|delete <func_…> --connection <int_…>` | turns it on / off, deletes it | `POST …/enable`, `POST …/disable`, `DELETE …` |
| `norbix code marketplace functions invoke <func_…> [--payload '<json>' \| --payload-file <file>]` | calls it as you; prints `isSuccess`, `output`, `vendorRequestId` | `POST /functions/{func}/invoke` |
| `norbix code marketplace runs --function <func_…> \| --trigger <trg_…> \| --task <tsk_…> [--limit <1-50>] [--details]` | the last runs, newest first: `--function` every run of one function from every source (invoke, trigger, scheduler; 50 kept), `--trigger` / `--task` the runs it started (20 kept). A row has `status` (`ok` / `failed` / `skipped`), `durationMs`, `source`, `correlationId`, `hasDetails`; a Fake-vendor run also its `input` (secrets `***`), pretty-printed under the row. `--details` adds each run's log lines (input, steps, answer or error) for rows with `hasDetails: true`; any other row says "details need the project's logs on" | `GET /functions/runs`; `--details`: `GET /logs/audit?targetCorrelationId=…` per row |

Notes:

- `--arguments` takes inline JSON, `@file` or `-`. The wire stores every
  argument as text, so a non-string JSON value is sent as its JSON text
  (`"filter": {"status":"paid"}` → `filter = '{"status":"paid"}'`,
  `"pageSize": 20` → `"20"`). `--arg key=value` sets one argument and wins over
  `--arguments`.
- Razor tokens are allowed inside argument values: `@Model.Request.<name>`
  reads the caller's payload (declare it with `--input <name>`; a `required`
  input missing from the payload is refused before the vendor is called),
  `@Model.Project.Id` the project.
- On an MCP connection (the generic MCP server listing or a preset such as
  GitHub) the functions are the server's tools: `--key` is a tool name from
  `connections tools`, and `--arg` / `--arguments` bind the tool's arguments
  (tokens allowed). The server checks the values against the tool's input
  schema on Add (unknown tool, missing required argument, unknown argument,
  wrong type are refused). Invoke answers `{ text, json, content }`.
- `functions add` is refused (`CM-ERRORS-MARKETPLACE-013`) until every step the
  listing marks required has passed — run `connections validate` first; its
  last line says whether functions can be added.
- `delete` and `disable` ask first; pass `--yes` in a script. Every command
  that changes something takes `--dry-run`. `--json` prints the raw answer.
- Token mappings, the function catalog and revealing a stored secret are not
  commands here; use plain-word access (see the README):
  `norbix hub code marketplace integration token mappings set --integrationViewId <int_…> --tokenMappings:json '[…]'`,
  `norbix hub code marketplace function catalog get --integrationViewId <int_…>`,
  `norbix hub code marketplace integration secrets reveal --integrationViewId <int_…>`.

### Recipe: query your own database through a marketplace function

Norbix Database is a built-in listing: enabling it picks the project's
database integration on its own (when there is exactly one) and validates at
once.

```sh
# 1. What does the listing offer? (functions, parameters, validation steps)
norbix code marketplace listings ml_norbix_database_v1

# 2. Enable it — prints the new connection id
norbix code marketplace connections enable --listing ml_norbix_database_v1
#   Connection int_6rBACnEaxQ0x1jTiHtAuWV created.
#   Next: norbix code marketplace connections validate int_6rBACnEaxQ0x1jTiHtAuWV

# 3. Validate — the database must open before functions can be added
norbix code marketplace connections validate int_6rBACnEaxQ0x1jTiHtAuWV
#   ok      database.connect  Database opens (required)
#
#   Functions: can be added.

# 4. Add db.find: paid orders of the customer the caller names
norbix code marketplace functions add --connection int_6rBACnEaxQ0x1jTiHtAuWV --key db.find --name "Paid orders" \
  --arguments '{"collection":"orders","filter":{"status":"paid","customerId":"@Model.Request.customerId"},"sort":{"createdAt":-1},"pageSize":20}' \
  --input customerId:string:required
#   Function func_4hT8rW2nQ6xLmP0vZ3kJ1c added.

# 5. Call it by hand
norbix code marketplace functions invoke func_4hT8rW2nQ6xLmP0vZ3kJ1c --payload '{"customerId":"6ac54a59212c29912eaddd81"}'
#   { "isSuccess": true, "output": { … the records … }, "vendorRequestId": … }

# 6. After a trigger or a scheduler task calls it (cloud: the trigger's
#    Marketplace action, with a run-as service user), read its last runs
norbix code marketplace runs --trigger trg_1p4R3gTobGZpD6fXvHT4rd --limit 10

# 7. Every run of the function — your invoke in step 5 too — with what it
#    received and answered. Details exist only while the project's logs are on
#    in that environment; other rows say so. One run's lines alone:
#    norbix logs trail <correlationId>
norbix code marketplace runs --function func_4hT8rW2nQ6xLmP0vZ3kJ1c --limit 5 --details
#   { "event": "invoke", "source": "user", "status": "ok", "durationMs": 42, "hasDetails": true, … }
#   details:
#     2026-10-13T08:01:00.010Z Information marketplace:run:started  …
#     2026-10-13T08:01:00.052Z Information marketplace:run:completed  …
```

The function runs as the caller: a manual `invoke` as you, a trigger or a
scheduler task as its run-as user. That user's roles decide which collections
`db.find` may read.
