# Using the Norbix CLI from a coding agent

The recipe a coding agent (Claude Code, Cursor, Codex, OpenCode) follows to
work on a Norbix backend from the shell. `norbix ai init` writes a short
version of this into your project (a Claude Code skill, a `CLAUDE.md` /
`AGENTS.md` block, a Cursor rule). The guarantees behind it are in
[`agent-contract.md`](agent-contract.md).

## 0. Install

```sh
npm install -g @norbix.ai/cli      # or: npx @norbix.ai/cli …
norbix --version
```

## 1. Sign in — the human does it, once

First call of a session: `norbix whoami --json`. Exit 4 means no usable
credentials — stop and ask the user to sign in. The agent never runs
`norbix login` or `norbix configure` itself (they need a terminal), and never
asks for a password, key or token in the chat.

- **On a developer's machine:** the user runs `norbix login` in their own
  terminal. It opens the Norbix dashboard, where they pick the roles the
  agent gets; the CLI then works as an AI service user `Norbix CLI (<computer>)`
  with exactly those roles, refreshes its token by itself, and can be removed
  any time under Account → AI service users. `norbix whoami --json` shows it
  under `session` (`aiServiceUser: true`, `expiresAt`).
- **In CI:** a **profile** created once by a human
  (`norbix login --api-key nbk_… --project <id> --region nb-eu-germany --profile ci`,
  then every call takes `--profile ci`) or **environment variables**
  (`NORBIX_API_KEY`, `NORBIX_PROJECT_ID`, `NORBIX_REGION`, and `NORBIX_ENV`,
  `NORBIX_ACCOUNT_ID` when needed).

When a sign-in has ended (removed in the dashboard, or 30 days unused), a
command exits 4 with `error.code` `SESSION_EXPIRED`: ask the user to run
`norbix login` again.

Never print, echo or paste a key or token, and never read `~/.norbix`.

## 2. Always `--json`

Stdout is then exactly one JSON document: the result, or
`{"error": {code, message, status, exit, fieldErrors, url, traceId, hint, docs}}`.
Nothing else is printed on stdout; stderr carries progress and warnings.

## 3. Discover, do not guess

```sh
norbix schema --json                 # every command: args, flags, examples, destructive, supportsDryRun
norbix schema users delete --json    # one command
norbix users delete --help           # the human page, with a realistic example
norbix hub scheduler --json          # SDK methods of a module with their request fields
norbix hub scheduler task delete --help
```

Prefer the named commands (`db`, `users`, `files`, `email`, `sms`, `push`,
`scheduler`, `logs`, `env`, `apikeys`, `webhooks`, `payments`, `account`).
When there is none, every SDK endpoint is reachable with plain words:

```sh
norbix hub scheduler task delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes --json
norbix hub scheduler task save --body '{"name":"nightly","cron":"0 2 * * *","initiatorUserId":"usr_123","isEnabled":true,"stopOnError":false,"task":{"type":"EmailCampaign","campaign":{"source":"AllUsers","templateId":"tpl_123"}}}' --json
```

`--body` takes the whole request as JSON (nothing is merged with
`--field` flags); `--field:str value` forces a string when a value looks
like a number.

## 4. Change things in two steps

```sh
norbix db update orders --id 66b2f0a1c3d4e5f6a7b8c9d0 --update '{"status":"shipped"}' --dry-run --json
# inspect "http" and "request" …
norbix db update orders --id 66b2f0a1c3d4e5f6a7b8c9d0 --update '{"status":"shipped"}' --json
```

Show the dry run to the user before the real call. A **destructive**
command (`destructive: true` in the schema) additionally needs `--yes`; without it, and without a terminal, it exits 3 and sends
nothing. Never add `--yes` to a first attempt — dry-run first.

## 5. Branch on the exit code

| exit | meaning | next step |
|---|---|---|
| 0 | ok | |
| 2 | usage error | read `error.message`, fix the call (`--help`) |
| 3 | confirmation required | re-run with `--yes` after a dry run |
| 4 | not authenticated / forbidden | ask for credentials or another profile |
| 5 | not found | check the id, `--env`, `--project`; list first |
| 6 | validation | `error.fieldErrors` names the fields |
| 7 | network | check `--region`, endpoints, connectivity |
| 8 | server / rate limit | retry with backoff; keep `error.traceId` |
| 9 | cancelled | |
| 1 | internal | report with `error.traceId` |

`error.hint` says what to do; `error.docs` says where to read.

## 6. Set up a project once

```sh
cd my-project
norbix ai init                 # Claude Code skill + CLAUDE.md block
norbix ai init --target all    # also AGENTS.md and a Cursor rule
norbix ai init --dry-run       # see what it would write
```

Files are never overwritten without `--force`; an existing block is left
alone.
