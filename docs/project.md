# `norbix project`

Manage one project's settings from the terminal: name, look, languages,
regions, CORS origins, the admin portal, legal documents and AI chat.

Every command acts on the configured project (`norbix configure`, the login
session, `NORBIX_PROJECT_ID`) or the one passed with `--project`. List the
account's projects with `norbix account projects`.

Every command is covered by `tests/project-routes.test.ts`, which runs it
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

`--file-resource` is the stored file, as the files module describes it (a JSON
object with `resource`, `integrationId`, `provider`, `path`, `isPublic`) —
inline, `@file.json`, or `-`. Upload the image with `norbix files upload` first.

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
| `norbix project admin-portal enable` | turn the admin portal on | `PUT /admin-portal/enabled` |
| `norbix project admin-portal disable [--yes]` | turn it off | `PUT /admin-portal/enabled` |
| `norbix project admin-portal structure` | show its layout (service user only) | `GET /admin-portal/structure` |
| `norbix project admin-portal set-service-user <id>` | pick the service user it acts as | `PUT /settings/admin-portal/service-user` |
| `norbix project admin-portal set-url (<url> \| --clear)` | use your own address, or the Norbix one again | `PATCH /settings/admin-url` |

## Legal documents

| command | what it does | endpoint |
|---|---|---|
| `norbix project legal set [--terms-file <md>] [--privacy-file <md>] [--clear-terms] [--clear-privacy]` | save the Terms & Conditions and Privacy Policy | `PATCH /settings/legal` |
| `norbix project legal expose` | show them to the public | `PATCH /settings/legal/expose` |
| `norbix project legal hide` | stop showing them | `PATCH /settings/legal/expose` |
| `norbix project legal show <terms\|privacy>` | read one the way the public does | API host `GET /{version}/public/projects/{ProjectId}/legal/{Kind}` |

The server clears a document it does not get, so `legal set` with one file
reads the other from the project and sends it back unchanged.

## AI chat

| command | what it does | endpoint |
|---|---|---|
| `norbix project ai settings` | show AI chat settings and the assistants | `GET /ai/settings` |
| `norbix project ai settings set [--enable \| --disable] [--llm <id>] [--model <m>]` | change them | `GET /ai/settings`, then `PUT /ai/settings` |
| `norbix project ai assistant create --name <n> [flags]` | add an assistant | `POST /ai/assistants` |
| `norbix project ai assistant update <id> [flags]` | change an assistant | `GET /ai/settings`, then `PUT /ai/assistants/{assistantId}` |
| `norbix project ai assistant delete <id> [--yes]` | delete an assistant | `DELETE /ai/assistants/{assistantId}` |
| `norbix project ai usage [--top <n>]` | this period's usage: totals, per assistant, per model, top users | `GET /ai/usage` |

Assistant flags: `--name`, `--welcome`, `--system-prompt` or
`--system-prompt-file`, `--toolset` (repeat), `--llm`, `--model`,
`--memory` / `--no-memory`, `--rag-source` (repeat), `--default` /
`--no-default`. The server replaces settings and assistants as a whole, so
`settings set` and `assistant update` read the stored values first and change
only what you pass. The LLM integrations themselves are `norbix ai llm …`
([docs/ai.md](ai.md)).

```bash
norbix project ai settings set --enable --llm llm_123 --model gpt-4o-mini
norbix project ai assistant create --name Support --system-prompt-file support.md --toolset ai:database-read
norbix project ai assistant update ast_123 --no-memory
```

## Not offered (yet)

- **`project list`** — the list is `norbix account projects`; one name per
  command.
- **Expose brand / expose auth to the admin portal** — planned for the next
  wave.
- **AI plans, knowledge, credits** — internal, not for the CLI.
- **Create a project, environments** — `norbix env …` and the portal.
