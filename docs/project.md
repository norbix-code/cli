# `norbix project`

Manage one project's settings from the terminal: create it, its health,
name, look, languages, regions, CORS origins, the admin portal, legal
documents, what the public sees, AI chat and the end-user AI plans.

Every command acts on the configured project (`norbix configure`, the login
session, `NORBIX_PROJECT_ID`) or the one passed with `--project`. List the
account's projects with `norbix account projects`.

Every command is covered by `tests/project-routes.test.ts` or
`tests/settings-routes.test.ts`, which run it
through the real SDK with `fetch` replaced and checks the verb, host and path
of each request it sends, and the request body where the body matters. No test
contacts a real project.

All hub paths below are under `/{version}/account/projects/{projectId}`.

## The project

| command | what it does | endpoint |
|---|---|---|
| `norbix project [id]` | show the project (name, languages, regions, origins, admin portal, modules) | `GET /` |
| `norbix project set-name <name>` | rename it | `PATCH /settings/name` |
| `norbix project set-description (<text> \| --clear)` | set or clear the description | `PATCH /settings/description` |
| `norbix project set-url (<url> \| --clear)` | set or clear the website address | `PATCH /settings/url` |
| `norbix project set-logo (--file-resource <json> \| --clear)` | set or clear the logo | `PATCH /settings/logo` |
| `norbix project set-icon (--file-resource <json> \| --clear)` | set or clear the icon | `PATCH /settings/icon` |
| `norbix project set-colors [--main <hex>] [--accent <hex>]` | set the brand colours (one call each) | `PATCH /settings/main-color`, `PATCH /settings/accent-color` |
| `norbix project set-languages <lang>...` | replace the language list | `PATCH /settings/languages` |
| `norbix project set-default-language <lang>` | pick the default language | `PATCH /settings/default-language` |
| `norbix project set-regions [--primary <r>] [--additional <r>]... [--clear-additional]` | set the regions | `PATCH /settings/regions` |
| `norbix project enable` | turn a disabled project back on | `PATCH /enable` |
| `norbix project disable [--yes]` | turn the project off (nothing is deleted) | `PATCH /disable` |
| `norbix project delete [--yes]` | delete the project and its data | `DELETE /` |
| `norbix project tokens [--initiator <id>] [--recipient <id>] [--target-user <id>]` | list the template tokens (`@Model…`) the project offers | `GET /tokens` |
| `norbix project public-config [id]` | show the public config apps read before sign-in | API host `GET /{version}/public/projects/{ProjectId}/config` |
| `norbix project create --name <n> --connection-string <cs> [--database <db>] [--primary <region>] [--additional <region>]... [--description <text>] [--config <json>]` | create a project on your own MongoDB database | `POST /{version}/account/projects` |
| `norbix project wait-active [--timeout <s>]` | wait until a new project is ready (at most 90 s; a timeout answers `isActive: false`) | `GET /wait-active` |
| `norbix project health [--refresh] [--period 7\|30\|90] [--severity Error\|Warning] [--module <name>] [--page-size <n>] [--page <n>]` | what is wrong with the project (errors first) and the Cloud page that fixes each, plus user / e-mail / API call numbers; `warningsTotal` says how many problems match | `GET /health` |
| `norbix project check-languages [<lang>...] [--default <lang>]` | the e-mail / push / SMS templates that miss a language of a proposed list; changes nothing | `POST /settings/languages/check` |

`--file-resource` is the stored file, as the files module describes it (a JSON
object with `resource`, `integrationId`, `provider`, `path`, `isPublic`) —
inline, `@file.json`, or `-`. Upload the image with `norbix files upload` first.

`project create` is account-level: it needs no project. `--primary` is required
on the Managed Service (norbix.ai); the command never guesses it. The project
prepares itself in the background, so run `project wait-active --project <id>`
once before you build inside it. A dry run prints the connection string as
`***`.

The primary region is set once and never changes. `--additional` is the full
new list; without it (and without `--clear-additional`) the command reads the
current additional regions and sends them back unchanged.

`project delete` and `project disable` ask first. With no terminal to ask in
(a script, a pipe) they refuse unless you pass `--yes`.

```bash
norbix project
norbix project set-name "Shop backend"
norbix project set-languages en lt de
norbix project set-default-language en
norbix project set-colors --main "#1F6FEB" --accent "#F78166"
```

## CORS origins

| command | what it does | endpoint |
|---|---|---|
| `norbix project cors` | list the allowed origins | `GET /` (reads `allowedOrigins`) |
| `norbix project cors set <origin>... [--remove-admin-portal-origin]` | replace the whole list | `PATCH /settings/origins` |
| `norbix project cors add <origin>...` | allow more origins, keep the rest | `GET /`, then `PATCH /settings/origins` |
| `norbix project cors remove <origin>... [--remove-admin-portal-origin]` | stop allowing some, keep the rest | `GET /`, then `PATCH /settings/origins` |

The server stores the list as a whole, so `add` and `remove` read it first. An
origin with no scheme means `https`. One origin is usually the project's own
admin portal (`pr_{projectId}.…`); the server refuses a list without it unless
you pass `--remove-admin-portal-origin`.

## Admin portal

| command | what it does | endpoint |
|---|---|---|
| `norbix project admin-portal structure` | show its layout (service user only) | `GET /admin-portal/structure` |
| `norbix project admin-portal set-service-user <id>` | pick the service user it acts as | `PUT /settings/admin-portal/service-user` |
| `norbix project admin-portal set-url (<url> \| --clear)` | save the address where you run the portal (its origin joins CORS), or remove it | `PATCH /settings/admin-url` |

## Legal documents

| command | what it does | endpoint |
|---|---|---|
| `norbix project legal set [--terms-file <md>] [--privacy-file <md>] [--clear-terms] [--clear-privacy]` | save the Terms & Conditions and Privacy Policy | `PATCH /settings/legal` |
| `norbix project legal show <terms\|privacy>` | read one the way the public does | API host `GET /{version}/public/projects/{ProjectId}/legal/{Kind}` |

The server clears a document it does not get, so `legal set` with one file
reads the other from the project and sends it back unchanged.

## What the public sees

The public project config (`project public-config`) is what an admin portal or
a sign-in page reads before anyone signs in. It always holds the brand, the
sign-in methods and the password policy; saved legal documents are always
public too.

| command | what it does | endpoint |
|---|---|---|
| `norbix project brand show <logo\|icon> [--output <file>]` | download the picture the way the public gets it | API host `GET /{version}/public/projects/{ProjectId}/brand/{Kind}` |

## AI chat

| command | what it does | endpoint |
|---|---|---|
| `norbix project ai settings` | show AI chat settings and the assistants | `GET /ai/settings` |
| `norbix project ai settings set [--enable \| --disable] [--llm <id>] [--model <m>]` | change them | `GET /ai/settings`, then `PUT /ai/settings` |
| `norbix project ai assistant create --name <n> [flags]` | add an assistant | `POST /ai/assistants` |
| `norbix project ai assistant update <id> [flags]` | change an assistant | `GET /ai/settings`, then `PUT /ai/assistants/{assistantId}` |
| `norbix project ai assistant delete <id> [--yes]` | delete an assistant | `DELETE /ai/assistants/{assistantId}` |
| `norbix project ai usage [--top <n>]` | this period's usage: totals, per assistant, per model, top users | `GET /ai/usage` |
| `norbix project ai knowledge set --embed-files <true\|false>` | put uploaded text files into the AI knowledge, or stop | `PUT /ai/knowledge` |
| `norbix project ai plans` | the end-user AI plans, the role → plan rows and the default plan | `GET /ai/plans` |
| `norbix project ai plans set (--plan <json>... [--remove <id>... --yes] \| --file <json> --yes)` | add, change or remove plans | `GET /ai/plans`, then `PUT /ai/plans` (`--file`: the `PUT` only) |
| `norbix project ai plans assign [--role <roleId>=<planId>]... [--clear-roles] [--default <planId> \| --clear-default]` | which plan a role gets, and the default | `GET /ai/plans` when one part is left out, then `PUT /ai/plans/assignments` |
| `norbix project ai plans users` | the users that have their own plan | `GET /ai/plans/users` |

Assistant flags: `--name`, `--welcome`, `--system-prompt` or
`--system-prompt-file`, `--toolset` (repeat), `--llm`, `--model`,
`--memory` / `--no-memory`, `--rag-source` (repeat), `--default` /
`--no-default`. The server replaces settings and assistants as a whole, so
`settings set` and `assistant update` read the stored values first and change
only what you pass. The LLM integrations themselves are `norbix ai llm …`
([docs/ai.md](ai.md)).

The plans and their assignments are replaced as a whole too: `plans set
--plan` and `--remove` read the stored list first (a `--plan` with a stored id
changes only the fields it names, an id that is not stored is refused, one
without an id is added), and `plans assign` keeps the
part you do not pass. `--remove` and `--file` drop plans, so they ask first
(`--yes`). `--dry-run` sends nothing, not even the read, so it shows only what
you pass.

```bash
norbix project ai settings set --enable --llm llm_123 --model gpt-4o-mini
norbix project ai assistant create --name Support --system-prompt-file support.md --toolset ai:database-read
norbix project ai assistant update ast_123 --no-memory
```

## No command on purpose

- **`project list`** — the list is `norbix account projects`; one name per
  command.
- **AI credit packs** (`POST /ai/credits/checkout`) — a purchase. Purchases are
  not a CLI use case (the same rule as Membership's end-user browser flows):
  the Stripe checkout is started in the dashboard.
- **A project on a Norbix-managed database** — created in the dashboard: it is
  placed on a cluster of the account and counts against the plan.
  `project create` takes your own MongoDB connection string.
- **Environments** — `norbix env …` ([README](../README.md#environments)).
