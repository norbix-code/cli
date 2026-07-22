# Norbix CLI

Manage your Norbix projects from the terminal. Built on top of the official
[`@norbix.ai/ts`](https://www.npmjs.com/package/@norbix.ai/ts) SDK, so every
command talks to the same API the SDK does.

Works on **macOS**, **Linux** and **Windows** (Node.js 18+).

## Install

```sh
npm install -g @norbix.ai/cli

# or run without installing:
npx @norbix.ai/cli --help
```

## Quick start

```sh
# 1. Log in (stores a token in your user config folder)
norbix login
# or with an API key:
norbix login --api-key nbk_... --project <projectId>

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
| `norbix db find/get/count/insert/update/delete/aggregate` | Work with database collections |
| `norbix files list/info/upload/download/sign/delete` | Upload, download and manage files |
| `norbix users list/get/invite/block/unblock/delete` | Manage project users (membership) |
| `norbix env list/use/delete` | Manage project environments |
| `norbix logs list/trail` | Read project logs, follow one correlation ID |
| `norbix scheduler list/get/enable/disable/delete` | Manage scheduler tasks |
| `norbix apikeys list/regenerate` | Show or regenerate project API keys |
| `norbix webhooks show/secret/enable/disable/remove` | Inspect the webhook integration |
| `norbix email templates/template/clone/archive/unarchive/delete/campaigns/campaign/stop` | Email templates and campaigns |
| `norbix push ...` / `norbix sms ...` | Push and SMS — same commands as email |
| `norbix account profile/status/usage/projects/team/regions/billing-portal` | Account-level info |
| `norbix payments integrations/triggers/trigger/enable/disable` | Payment integrations and triggers |
| `norbix integrations <module>` | List integrations of any module |
| `norbix module enable/disable <name>` | Turn a whole project module on or off |
| `norbix api <path>` | Call ANY endpoint directly (like `gh api`) — full API coverage |
| `norbix autocomplete` | Set up shell tab-completion (bash/zsh) |

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

Resolution order (most specific wins): flags → `NORBIX_*` env vars →
`--profile` (profile only) → session → `[default]` profile.
`norbix whoami` shows exactly what was resolved and verifies it against the
server. Defaults endpoints are `https://api.norbix.ai` and
`https://hub.norbix.ai`. See `AUTH_DESIGN.md` for the full design.

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

## Roadmap

- Standalone binaries (no Node needed): Homebrew, curl installer, Scoop/winget
- Device-code login (no password typed into the terminal)
- OS keychain storage for tokens
- `norbix logs list --follow` (live tail via SSE)

See `RESEARCH.md` for the full background on these choices.
