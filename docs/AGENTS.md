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

## 1. Sign in — the agent starts it, the human approves

First call of a session: `norbix whoami --json`. `"auth": "none"` there
(or exit code 4 from any other command) means no usable
credentials. The agent starts a browser sign-in and the human approves it in
the dashboard. The agent never runs `norbix configure` or a plain
`norbix login` (they need a terminal), and never asks for a password, key or
token in the chat.

- **On a developer's machine:** the agent signs in itself, in two steps
  (its shell commands time out; the code lives 10 minutes):
  1. `norbix login --no-browser --json` → `{status: "pending", userCode,
     verificationUriComplete, expiresIn, next}`. Show the user the link and
     the code. They open it, check the code, pick the roles the agent gets
     and press Allow. Never open the link yourself.
  2. `norbix login --wait --json` — waits up to 90 s. Exit 0: signed in as
     the AI service user `Norbix CLI (<computer>)` (removable under
     Account → AI service users; `norbix whoami --json` shows it under
     `session`). Exit 4 `AUTHORIZATION_PENDING`: not approved yet, run it
     again. `ACCESS_DENIED` / `EXPIRED_TOKEN`: start over with step 1
     (`ACCESS_DENIED` with `context.reason` `EmailNotVerified`: ask the
     person to verify their email in the dashboard first).

  Not on norbix.ai? Add `--host <their dashboard or Hub address>` (or
  `--profile <name>`) to both steps. The user can also sign in themselves
  with `norbix login` in their own terminal.
- **In CI:** never a browser sign-in. **Environment variables**
  (`NORBIX_HOST` — omit for norbix.ai —, `NORBIX_API_KEY`,
  `NORBIX_PROJECT_ID`, and `NORBIX_REGION`, `NORBIX_ENV`,
  `NORBIX_ACCOUNT_ID` when needed), or a **profile** created once by a human
  (`norbix login --api-key nbsu_… --project <id> --host <host> --profile ci`,
  then every call takes `--profile ci`).

When a sign-in has ended (removed in the dashboard, or 30 days unused), a
command exits 4 with `error.code` `SESSION_EXPIRED`: sign in again as above.

Never print, echo or paste a key or token, and never read `~/.norbix`.

### Environments: name one when the project has several

A project always has PROD and may have more (TEST, STAGING, …). Check first:
`norbix whoami --json` (`environments`, `envRule`) or `norbix env list --json`.

- **Only PROD:** pass no env — every command works in PROD (`--env PROD` /
  `--prod` changes nothing).
- **More than one:** every project command needs the env: `--env <name>`
  (`--prod` is short for `--env PROD`) or `NORBIX_ENV`. Ask the user which one
  when the task does not say it — never assume PROD. Without it the command
  exits 2 with `error.code` `ENV_REQUIRED` and the list of environments, and
  sends nothing (a `--dry-run` fails the same way).
- A default saved with `norbix env use <name>` (or `env =` in a profile)
  also counts; each command then prints `env: <name> (<where it is saved>)`
  on stderr. Read that line.
- Account commands (no project) and `norbix env …` are not checked.

The list of environments (and the promotion ladder, `promotionOrder`) is
cached for 5 minutes per project; `env list / use / delete` and an
"environment does not exist" error refresh it.

### Environments: build in TEST, promote to PROD

Never build PROD by hand when the project has a lower env. Schemas,
taxonomies, terms, templates, footers, signatures and triggers are made in TEST
and promoted:

1. `norbix env promote --from TEST --to PROD --json` — a preview (the
   default), nothing changes. Show the user `summary`, `items` (deleted ones
   with `recordCount`), `integrations` (`action`, `warning`, `realSender`) and
   `notPromoted`.
2. After the user agreed: the same command with `--yes`
   (`--seed / --skip / --map id=targetId` only for integrations the user
   decided; `--confirm-record-loss` only when `requiresConfirmation` is true and
   the user accepts it — exit 3 `CM-ERRORS-ENVIRONMENTS-013` means it was missing).
3. Keep `fromVersion`: `norbix env rollback --to PROD --version <fromVersion>`
   (preview, then `--yes`) undoes it.

A content command run straight in PROD while TEST exists prints
`Note: PROD is promoted from TEST — …` on stderr: make the change in TEST and
promote instead.

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

## 3a. Design a database schema by the rules

Before writing a data schema, print the rules and follow them:

```sh
norbix db schema rules           # which field for which value, with the exact JSON shape
norbix db schema rules --json    # the same as data
```

- Email → `{"type":"string","format":"email"}`; link / website / app link →
  `{"type":"string","format":"uri"}` — never bare text.
- Language / locale, currency code, country, status, category — any list
  people pick from → a taxonomy picker
  (`{"source":"taxonomy","taxonomyId":"<id>"}`), never bare text and not an
  inline enum. An enum is only for a developer-facing flag the app code
  branches on.
- A person (assignee, author, `*_user_id`) → a user reference
  (`{"source":"user","displayField":"displayName"}`), never a text id.
  Never add `createdBy` / `owner` / `createdAt`: the platform keeps them in
  `_meta` (`settings.hasRecordOwner`).

The Hub checks these rules when a schema is saved (`db schema create`,
`hub database schema save`) and when `hub account schema validate` runs. A
schema that breaks one is still saved; the answer carries `warnings` (on
stderr as text, and in the JSON on stdout). Fix each named field and save
again.

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
