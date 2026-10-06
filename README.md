# Norbix CLI

Manage your Norbix projects from the terminal. Built on top of the official
[`@norbix.ai/ts`](https://www.npmjs.com/package/@norbix.ai/ts) SDK, so every
command talks to the same API the SDK does.

Works on **macOS**, **Linux** and **Windows** (Node.js 22+).

## Install

```sh
npm install -g @norbix.ai/cli

# or run without installing:
npx @norbix.ai/cli --help
```

## Quick start

```sh
# 1. Sign in through the browser (the Norbix dashboard asks which roles the CLI gets)
norbix login
# or, for CI and scripts, with an API key:
norbix login --api-key nbk_... --project <projectId> --profile ci

# 2. Check everything is wired up
norbix whoami

# 3. Use it
norbix db find orders --filter '{"status":"paid"}' --page-size 20
norbix logs list --level Error
norbix scheduler list
```

## Commands

| Command | What it does |
| --- | --- |
| `norbix login` / `logout` / `whoami` | Authenticate and inspect the current context |
| `norbix config list/get/set/unset` | Manage the local config file |
| `norbix db ...` | Database records (find/get/count/insert/update/replace/delete/aggregate/change-owner), schemas (create/update/publish/delete/versions/diff), schema triggers, integrations, taxonomies and terms, indexes, test-data seed — see [docs/database.md](docs/database.md) |
| `norbix files list/info/upload/download/sign/delete/publish/unpublish` | Upload, download, manage and publish files |
| `norbix files integrations test <id>` | Check that a files integration really works (live upload/read/list/delete probe) |
| `norbix users list/get/invite/block/unblock/delete` | Manage project users (membership) |
| `norbix env list/use/delete` | Manage project environments |
| `norbix logs list/trail` | Read project logs, follow one correlation ID |
| `norbix scheduler list/get/save/enable/disable/delete` | Scheduler tasks — a cron that sends an email campaign; every scheduler endpoint, see [docs/scheduler.md](docs/scheduler.md) |
| `norbix apikeys list/regenerate` | Show or regenerate project API keys |
| `norbix webhooks show/secret/enable/disable/remove` | Inspect the webhook integration |
| `norbix email ...` | Email module, integrations, validation, footers, signatures, templates, campaigns, preview — every Email endpoint a developer calls, see [docs/email.md](docs/email.md) |
| `norbix push ...` | Push module, integrations, devices, templates, campaigns — every push endpoint, see [docs/push.md](docs/push.md) |
| `norbix sms ...` | SMS module, integrations, templates, campaigns — every SMS endpoint, see [docs/sms.md](docs/sms.md) |
| `norbix account profile/status/usage/projects/team/regions/billing-portal/me` | Account-level info; `account team` pages and filters, `account me set-phone` saves the phone "Account users" SMS campaigns use — see [docs/account.md](docs/account.md) |
| `norbix project ...` | One project's settings — name, look, languages, regions, CORS origins, admin portal, legal documents, AI chat and assistants, see [docs/project.md](docs/project.md) |
| `norbix ai ...` | LLM and MCP server integrations, AI service users and their keys, see [docs/ai.md](docs/ai.md) |
| `norbix payments integrations/triggers/trigger/enable/disable` | Payment integrations and triggers |
| `norbix integrations <module>` | List integrations of any module |
| `norbix module enable/disable <name>` | Turn a whole project module on or off |
| `norbix hub <module> <words...>` | Call ANY hub endpoint with plain words (see below) |
| `norbix api <module> <words...>` | Same for the data-plane API |
| `norbix raw <path>` | Low-level HTTP escape hatch (hub by default, `--api` for API) |
| `norbix schema [command]` | Describe every command as data (`--json`) — for scripts and agents |
| `norbix ai init` | Set up a project for Claude Code / Cursor / AGENTS.md agents |

### Plain-word access to every endpoint

`norbix hub` and `norbix api` resolve SDK methods from plain words — every
current and future SDK method is callable without waiting for a dedicated
command:

```sh
norbix hub                                     # list modules
norbix hub database                            # list database methods
norbix hub database aggregates get             # plural  = list
norbix hub database aggregate get maggr_123    # singular = one item
norbix hub database aggregates delete maggr_123 --schemaId sch_456
norbix hub scheduler tasks get --pageSize 100
norbix hub email templates get                 # email/sms/push route into notifications
```

The first positional value becomes `id`; `--field value` flags become request
fields, typed from the SDK's request type (`norbix hub <module> --help` lists
every method with its fields; `--json` returns them as data). Force a type
with `--field:str`, `--field:num`, `--field:bool` or `--field:json`, or pass
the whole request with `--body '<json>'`. Destructive verbs (delete, remove,
stop, disable, block, regenerate, rotate) ask for confirmation unless
`--yes` — and exit 3 without a terminal. Add `--dry-run` to preview the exact
HTTP request.

`norbix schema --json` describes every command (args, flags, examples,
destructive, dry-run) for scripts and coding agents; `norbix autocomplete`
sets up shell tab-completion (bash/zsh).

Run `norbix <topic> --help` for flags and examples.

## Configuration: profiles + sessions

Two ways to authenticate, and they work together:

**Profiles (AWS-style)** — one INI file at `~/.norbix/config`, set up with:

```sh
norbix configure                      # writes the [default] profile
norbix configure --profile fitskin    # a named profile
norbix db find orders --profile fitskin
```

It asks for a service-user API key, project ID, optional account ID and
environment (empty = PROD). A profile can also override the endpoints
(`api_url` / `hub_url`) for localhost or self-hosted installations.
`--profile` (or `NORBIX_PROFILE`) always uses exactly that profile and
ignores any login session — predictable for scripts.

**Sessions** — `norbix login` stores a session in `~/.norbix/session.json`.
While it is valid, every command (in every terminal window) uses it.
`norbix logout` removes it. Profiles are untouched by login/logout.

### Signing in: `norbix login`

`norbix login` signs in through the browser (the OAuth device flow):

1. The CLI prints a one-time code (`BCDF-GHJK`) and, after ENTER, opens the
   Norbix dashboard on the sign-in page. Over SSH, open the printed link on
   any device.
2. In the dashboard you check the code, pick the roles the CLI gets — account
   roles and project roles, the same pickers as when an AI tool connects over
   OAuth — and press **Allow**. You can never give more than you have.
3. The CLI works as an **AI service user** named `Norbix CLI (<computer
   name>)` with exactly those roles. `norbix whoami` shows it. Signing in
   again from the same computer with the same roles reuses the same user.

The access token lasts one hour and is refreshed by itself (the refresh
token lasts 30 days). To end the sign-in, run `norbix logout` (it also
revokes the refresh token on the Hub) or remove the user in the dashboard
under **Account → AI service users**; the next command then exits 4 and
asks you to run `norbix login` again.

| Situation | What happens | Exit |
| --- | --- | --- |
| You press **Deny** | `Sign-in was denied in the browser.` (`ACCESS_DENIED`) | 4 |
| Nobody approves within 10 minutes | `The sign-in code expired before it was approved.` (`EXPIRED_TOKEN`) | 4 |
| The Hub refuses the code (already used, unknown, the AI service user deleted) | The Hub's reason is shown (`INVALID_GRANT` / `INVALID_REQUEST`) | 4 |
| The sign-in was removed or ran out | The stored tokens are cleared (`SESSION_EXPIRED`) | 4 |
| The Hub is older than the browser sign-in | A one-line note, then user + password as before | — |

`norbix login --user <email>` forces the user + password sign-in (you, with
all your rights). **CI and scripts** use an API key instead, never a browser
sign-in: `norbix login --api-key nbk_... --project <id> --profile ci`, or the
`NORBIX_API_KEY` / `NORBIX_PROJECT_ID` / `NORBIX_REGION` variables.

The Hub version in the sign-in paths (`/v3/auth/device/...`, `/v3/oauth/token`)
is read from the Hub's `/echo`; set `NORBIX_HUB_VERSION` or `hub_version` in a
profile only to override it.

Resolution order (most specific wins): flags → `NORBIX_*` env vars →
`--profile` (profile only) → session → `[default]` profile.
`norbix whoami` shows exactly what was resolved and verifies it against the
server. Defaults endpoints are `https://api.norbix.ai` and
`https://hub.norbix.ai`. See `AUTH_DESIGN.md` for the full design.

**Endpoints (self-hosted / enterprise)** — the Hub and API URLs are resolved
on their own, first match wins:

1. `--profile <name>` (or `NORBIX_PROFILE`) whose profile sets `hub_url` / `api_url`;
2. `NORBIX_HUB_URL` / `NORBIX_API_URL`;
3. without `--profile`: the Hub and API a browser sign-in was made against
   (kept in the session, so the token refresh reaches the Hub that issued it);
4. the `[default]` profile, then the legacy config;
5. `https://hub.norbix.ai` / `https://api.norbix.ai` (with the region).

A URL may be written with or without its version: `https://hub.example.com`
or `https://hub.example.com/v3`. With a version, the CLI uses it for every
call; without one, the sign-in paths read it from the Hub's `/echo`.

```sh
export NORBIX_HUB_URL=https://hub.example.com/v3
export NORBIX_API_URL=https://api.example.com/v3
norbix login          # signs in on hub.example.com, no ~/.norbix/config edit
```

For CI/CD, use environment variables only:

```sh
export NORBIX_API_KEY=nbk_...
export NORBIX_PROJECT_ID=...
norbix db count orders
```

## JSON output

Every command supports `--json` and prints clean JSON on stdout, so you can
pipe into `jq`:

```sh
norbix db find orders --json | jq '.list.items[] | ._id'
```

## Errors and exit codes

A failed call prints the message, the details the server gave (code, HTTP
status, URL, trace id, field errors) and what to do next — on **stderr**, so
stdout stays clean for data:

```sh
$ norbix files info a/b.txt
Error: File not found: "a/b.txt" does not exist in Local (nbin_1).
  code: CM-ERRORS-FILES-016
  status: 404
  url: https://nb-eu-germany.api.norbix.ai/v2/files/...
Hint: Check the id, the --env and the --project. List items first (e.g. `norbix files list --json`).
Docs: norbix files info --help
```

With `--json` the same information is one JSON document on stdout:
`{"error": {"code", "message", "status", "exit", "fieldErrors", "url", "traceId", "hint", "docs"}}`.

The exit code tells a script or an agent what went wrong, with or without
`--json`:

| code | meaning |
| --- | --- |
| 0 | success |
| 1 | unexpected / internal error |
| 2 | usage: bad flags or arguments, invalid JSON input, unknown command, missing config |
| 3 | confirmation required — a destructive command ran without a terminal and without `--yes` |
| 4 | not authenticated / auth rejected (401, 403, no key) |
| 5 | not found (404) |
| 6 | validation rejected by the server (400 / 422) |
| 7 | network, timeout, endpoint unreachable |
| 8 | rate limited or server error (429, 5xx) |
| 9 | cancelled by you at a prompt |

Destructive commands (`delete`, `stop`, `regenerate`, `block`, `disable`,
`--many` updates) ask for confirmation in a terminal. In a script, in CI or
under a coding agent there is nobody to ask, so they **exit 3 and send
nothing** unless you pass `--yes`. Preview any of them with `--dry-run`:
the request is built with your real auth, region and project, printed, and
not sent.

## Use with Claude Code / AI agents

The CLI is built to be driven by a coding agent from the shell — no MCP
server needed: one JSON document per call (`--json`), documented exit codes
(0–9), nothing destructive without `--yes`, `--dry-run` on every change, and
`norbix schema --json` to discover every command. Set a project up once:

```sh
norbix ai init                 # writes .claude/skills/norbix/SKILL.md + a CLAUDE.md block
norbix ai init --target all    # also AGENTS.md (Codex, OpenCode) and a Cursor rule
```

Then sign in once with `norbix login` in your own terminal: the dashboard
asks which roles the agent gets, and the agent works as an AI service user
you can remove any time (Account → AI service users). The written rules tell
the agent to start with `norbix whoami --json`, to ask you to run
`norbix login` when that exits 4 (never to run it itself), to pass `--json`
to everything it parses, to run every change with `--dry-run` first and show
it to you, and never to print or ask for keys or tokens. In CI, give the
agent a profile (`norbix login --api-key … --profile ci`) or
`NORBIX_API_KEY` / `NORBIX_PROJECT_ID` / `NORBIX_REGION` instead.

The recipe the agent follows is in [docs/AGENTS.md](docs/AGENTS.md); the
guarantees it relies on are in [docs/agent-contract.md](docs/agent-contract.md).

## Versioning

The major version is frozen at **v1** until the public launch.

- A breaking change is released as a **minor** (for example v1.2.0 → v1.3.0), never as a new major.
- Write it as `feat(<scope>): <what>` and add a line `Breaking: <what changed and what callers must do>` in plain words, in the pull-request body and in the commit message.
- Never mark it the conventional-commits way: no `!` in the title (`feat!:`), no BREAKING CHANGE footer. The `PR title` check fails a pull request that does.
- As a safety net, the release config (`.releaserc.json` → `releaseRules`) maps breaking commits to a minor, so one that slips through still does not bump the major.

## Development

```sh
npm install
npm run build          # compile TypeScript to dist/
./bin/run.js --help    # run the local build
```

Commands live in `src/commands/<topic>/<name>.ts` — one file per command
(oclif convention). Shared logic (auth resolution, config store, output) is in
`src/base.ts` and `src/lib/`.

## Files: pick your integration once

File commands need a files integration ID. Set it once:

```sh
norbix config set filesIntegrationId <id>
norbix files upload ./invoice.pdf invoices/2026/invoice.pdf
norbix files download invoices/2026/invoice.pdf
```

Or pass `--integration <id>` (env var: `NORBIX_FILES_INTEGRATION_ID`).

### The file commands

| Command | What it does |
| --- | --- |
| `norbix files list [path]` | List the files and folders under a path. No path lists the root. |
| `norbix files info <path>` | Show one file's details: size, type, when it changed. |
| `norbix files sign <path> [--expires <seconds>]` | Get a temporary web address for the file that anyone with the link can open. |
| `norbix files upload <local> [remote]` | Upload a file. Without `remote` it keeps its own name in the root folder. |
| `norbix files download <remote> [local]` | Download a file. Without `local` it keeps its own name in the current folder. |
| `norbix files delete <path> [--yes]` | Delete one file. Asks first unless you pass `--yes`; without a terminal it exits 3 unless `--yes`. |
| `norbix files publish <path> [--folder]` | Give the file — or the whole folder — a link anyone can open, and print it. |
| `norbix files unpublish <path> [--folder]` | Take that link away again. |
| `norbix files integrations test <id>` | Check that the storage behind an integration really works. See below. |

Upload and download take more than one step, so the file bytes never pass
through Norbix:

* **upload** — ask for a short-lived upload address, send the bytes straight to
  storage, then tell Norbix the upload finished.
* **download** — ask for a short-lived download address, then fetch the bytes
  from storage.

`--content-type` overrides the type on upload; without it the type is guessed
from the file name.

### Publishing a file

`sign` and `publish` both give you a web address, and they are not the same
thing:

* **`sign`** hands out a *temporary* address that expires by itself. Good for a
  download button on a page somebody is already signed in to.
* **`publish`** makes the file public *until you say otherwise*. The address
  has no expiry and no sign-in: it works in an e-mail, in an `<img src>`, or in
  a browser on somebody else's phone.

```sh
norbix files publish invoices/2026/invoice.pdf
# https://api.norbix.ai/v3/files/public/nbpf_7hK2abc/invoice.pdf

norbix files unpublish invoices/2026/invoice.pdf
# invoices/2026/invoice.pdf is private again — its link now gives a 404
```

`--folder` does the same for a whole folder. That is **one** record however
many files sit under it, and every file inside becomes readable by putting its
path inside the folder after the link:

```sh
norbix files publish invoices --folder
# https://api.norbix.ai/v3/files/public/nbpf_folder1/
#   → .../nbpf_folder1/2026/invoice.pdf
```

Four rules worth knowing:

* Publishing the same thing twice gives the same link back — the first one is
  already in somebody's hands.
* A file cannot be unpublished on its own while a folder above it is public.
  The command says so and names the folder to switch off instead.
* Unpublishing a folder takes back every link inside it, per-file links
  included.
* Every dead link answers the same plain `404`: unknown, renamed, unpublished,
  deleted. A more precise answer would tell a stranger that the file is there.

### Testing an integration

`norbix files integrations test <id>` runs a live probe against the storage
behind the integration: it uploads a small file, reads it, lists its folder and
deletes it again. One line per step:

```sh
norbix files integrations test 55555555-5555-5555-5555-555555555555
# UploadFile   OK
# GetFile      FAILED
#                - NoSuchKey: the object was not found
# GetAllFiles  NOT_TESTED
# DeleteFile   NOT_TESTED
#  ›   Error: The files integration test failed: GetFile FAILED (2 later steps not tested).
```

`NOT_TESTED` means the step was skipped because an earlier one failed. The
command exits `0` only when every step is `OK`, so it works in a script or a
CI job. `--json` prints the steps as data and keeps the same exit code. The
probe writes to the storage, so the key needs the `files:create` permission.

## Tests

```sh
npm test
```

The tests build the CLI and run each command through oclif with `fetch`
replaced, so nothing leaves the machine and no account is needed. `HOME` points
at an empty temporary folder during the run, so your own `~/.norbix` settings
and login session are never read.

## Roadmap

- Standalone binaries (no Node needed): Homebrew, curl installer, Scoop/winget
- OS keychain storage for tokens
- `norbix logs list --follow` (live tail via SSE)

See `RESEARCH.md` for the full background on these choices.
