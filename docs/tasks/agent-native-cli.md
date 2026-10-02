# Agent-native CLI — hardening + Claude Code integration via CLI

Status: open · Branch: create your own worktree from `main` (suggested name `feat/agent-native-cli`)
Related, in parallel (do NOT touch): MCP server work for Norbix. This task is the **CLI path**:
a frontier coding agent (Claude Code, Cursor, OpenCode, Codex) is told to use `norbix` from a shell.

## 0. Why this exists

Norbix is about to launch "works with frontier models". One integration path is MCP; the other is
this CLI. Agents already know how to run shell commands, so a CLI that behaves predictably in a
non-interactive shell is zero-setup integration. Today the CLI is good for humans but has gaps that
make it unsafe or noisy for agents. This document lists the verified gaps, the target behaviour, and
the integration deliverables. The human experience (text output, prompts in a terminal) must stay.

Everything in §2 was verified on 2026-10-02 against the current `main` by running the built CLI
against a local fake HTTP server (script in §6). Re-run the script before and after your changes.

## 1. Target behaviour ("the agent contract")

These are the rules the CLI must satisfy. Put a copy of this section into `docs/agent-contract.md`
and link it from README; `norbix schema` (§3.4) must print its URL/path too.

1. **Never hang, never act silently.** In a non-interactive shell (stdout or stdin not a TTY, or
   `CI` set), any command that needs a confirmation and did not get `--yes` MUST exit non-zero
   (code 3) with a one-line stderr message that names the flag. It must not send the request.
   In a terminal without `--yes`, ask as today.
2. **`--json` means stdout is exactly one JSON document, always.** Success: the result. Failure:
   `{"error": {...}}` with the envelope in §3.2. No text on stdout in JSON mode, ever. Progress and
   warnings go to stderr. Exit code is the same with and without `--json`.
3. **Errors carry everything the SDK knows** (status, code, fieldErrors, url) plus a `hint`
   (what to do next) and `docs` (URL or `norbix <cmd> --help`).
4. **Documented exit codes** (see §3.1). Agents branch on them.
5. **`--dry-run` on every mutating command.** It resolves auth/endpoints/project exactly as a real
   call would (so a dry run that would fail for real also fails), prints the request that would be
   sent, sends nothing, exits 0.
6. **Discoverable without reading source.** `norbix schema [command] --json` returns the full
   command surface (args, flags, types, required, env var, default, examples, destructive: bool,
   supportsDryRun: bool). `--help` on every command includes at least one example with real-looking
   values and, for mutating commands, the `--dry-run` / `--yes` pattern.
7. **Cheap to run.** Startup under 200 ms for `--version`; heavy modules loaded lazily.
8. **No ANSI codes when `--json`, `NO_COLOR`, or non-TTY.** (No colour lib today — add the check
   now so it stays true.)

## 2. Verified findings (with reproductions)

### 2.1 Destructive commands run with no confirmation when there is no terminal — CRITICAL

Pattern in ~15 commands (`users/delete.ts`, `sms/delete.ts`, `sms/stop.ts`, `push/delete.ts`,
`push/stop.ts`, `push/integration/delete.ts`, `email/*`, `files/delete.ts`, `scheduler/delete.ts`,
`env/delete.ts`, `apikeys/regenerate.ts`, `module.ts`, `db/delete.ts --many`,
`lib/namespace-command.ts` for `hub`/`api`):

```ts
if (!flags.yes && process.stdout.isTTY) {
  const ok = await confirm({message: `Delete user ${args.id}?`, default: false})
  if (!ok) return this.print('Cancelled.')
}
const res = await client.api.membership.deleteUser({id: args.id})   // reached when !isTTY
```

Observed (`</dev/null`, no `--yes`): `users delete abc123` → `DELETE /v2/membership/auth?id=abc123`
sent, stdout `User abc123 deleted.`, exit 0.
Also: `db update --many` has **no `--yes` flag and no confirmation at all**; `db delete --id`
never asks (only `--many` does). Side effect for humans: `norbix users delete x | tee log` also
skips the prompt because stdout is a pipe.

### 2.2 `--json` error output is inconsistent (5 shapes)

| Error source | stdout | stderr | exit |
|---|---|---|---|
| config error (unknown profile) | `{"error":{...}}` | – | **1** (text mode gives 2) |
| server error 404/400/401 (`NorbixError`) | **empty** | text | 2 |
| network failure ("fetch failed") | **empty** | text | 2 |
| unknown command | **empty** | text | 2 |
| `raw` + HTTP 500 | `{"error":{"message":"EEXIT: 1"}}` — server body lost | – | 1 |
| missing required flag | JSON, **22 677 lines** (oclif dumps the whole parse context: all commands, pjson, home paths) | – | 1 |

Cause: `BaseCommand.catch` only handles `NorbixError` and calls `this.error(text)`; oclif's own
JSON error path handles the rest and serialises every property of the error object.

### 2.3 Error details the SDK provides are thrown away

```ts
// node_modules/@norbix.ai/ts/dist/index.d.cts
declare class NorbixError extends Error {
  readonly status: number; readonly code?: string;
  readonly fieldErrors: ...; readonly raw?: unknown; readonly url?: string;
}
declare class NorbixNetworkError extends NorbixError {...}
declare class NorbixTimeoutError extends NorbixError {...}
```
```ts
// src/base.ts — keeps only message + status
protected async catch(error) {
  if (error instanceof NorbixError) {
    const status = (error as {status?: number}).status
    const suffix = status ? ` (HTTP ${status})` : ''
    const hint = status === 401 ? '\nYour session may have expired. Run `norbix login` again.' : ''
    return this.error(`${error.message}${suffix}${hint}`)
  }
  return super.catch(error)
}
```
Observed: 400 with `errors:{email:["is required"]}` prints `Validation failed (HTTP 400)`; a
connection refused prints `fetch failed` with no URL (agent cannot tell wrong region / server down /
typo in `api_url`).

### 2.4 `login` password path is not guarded

`login.ts` guards the "Press ENTER" prompt with `isTTY` but the password prompt is not guarded.
`norbix login --user a </dev/null` → prompt, `ExitPromptError` stack trace, Node "unsettled
top-level await" warning, exit 1, no hint about `--password` / `--api-key`.

### 2.5 `hub` / `api` word parser has agent traps (`src/lib/dispatch.ts`)

```ts
function coerce(value) {            // "0042"→42, "37061234567"→number, "true"→boolean; no escape hatch
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+$/.test(value)) return Number(value)
}
function looksLikeId(token) {       // "v2", "PROD", "SMS" are treated as ids, not words
  return /[_0-9]/.test(token) || token === token.toUpperCase()
}
// `--flag value`: a boolean flag followed by a positional swallows it (fields.archived = "some_id")
```
Also `--dry-run` in `namespace-command.ts` returns before `this.client(flags)`, so it does not
check that auth / region / project resolve.

### 2.6 Exit codes and "Cancelled"

All failures are 1 or 2 (chosen by oclif). Answering "no" to a confirmation prints `Cancelled.`
to **stdout** and exits **0** — scripts cannot tell cancelled from done.

### 2.7 Startup / lazy loading

`node bin/run.js --version` ≈ 0.6 s in the working tree. `@inquirer/prompts` is imported at module
top in ~15 command files; `oclif.manifest.json` is only produced in `prepack` (so dev runs scan
`dist/commands` on every start). Measure after `oclif manifest` and lazy imports.

### 2.8 Tests

`tests/` (push) and `test/` (files) only. Nothing covers non-TTY behaviour, exit codes, or the JSON
error shape — exactly what agents depend on.

## 3. Specification of the changes

### 3.1 Exit codes (`src/lib/exit-codes.ts`, exported const + documented in `docs/agent-contract.md`)

| code | meaning | typical hint |
|---|---|---|
| 0 | success | |
| 1 | unexpected / internal error | file an issue, include `traceId` |
| 2 | usage: bad flags/args, invalid JSON input, unknown command | `norbix <cmd> --help` / `norbix schema <cmd> --json` |
| 3 | confirmation required (non-interactive, no `--yes`) | re-run with `--yes` after `--dry-run` |
| 4 | not authenticated / auth rejected (401, 403, no key) | `norbix login`, `--api-key`, `--profile` |
| 5 | not found (404) | check id / env / project |
| 6 | validation rejected by server (400/422) | `fieldErrors` lists fields |
| 7 | network / timeout / endpoint unreachable | shows URL; check `--region`, `api_url`, connectivity |
| 8 | rate limited / server error (429/5xx) | retry with backoff; include `traceId` |
| 9 | cancelled by user at a prompt | |

Exit codes must be identical with and without `--json`.

### 3.2 JSON error envelope (stdout, one document)

```json
{
  "error": {
    "code": "NOT_FOUND",            // SDK code if present, else derived from status / category
    "message": "User not found",
    "status": 404,                   // HTTP status when applicable
    "exit": 5,
    "fieldErrors": {"email": ["is required"]},   // only when present
    "url": "https://nb-eu-germany.api.norbix.ai/v2/membership/auth/abc",  // when known
    "traceId": "…",                  // when the server returns one (check NorbixError.raw)
    "hint": "Check the id, or list users with: norbix users list --json",
    "docs": "norbix users get --help"
  }
}
```
Implement in `BaseCommand.catch`: map every error (NorbixError family, oclif parse errors, JSON
input errors, unknown command, generic Error) to `{exit, code, message, hint, ...}`; in JSON mode
`logJson` this object and `this.exit(exit)`; in text mode print `Error: <message>` + details +
`Hint: …` to stderr. Never let oclif's default JSON error path run (it is what dumps 22k lines).
For unknown commands hook `bin/run.js` / a `command_not_found` hook so JSON mode still emits the
envelope.

### 3.3 Confirmation + dry-run helpers (`src/base.ts`)

```ts
static mutatingFlags = {
  yes:       Flags.boolean({char: 'y', description: 'Skip the confirmation prompt (required in non-interactive shells)'}),
  'dry-run': Flags.boolean({description: 'Resolve context and print the request that would be sent; send nothing'}),
}

protected isInteractive(): boolean {
  return Boolean(process.stdout.isTTY && process.stdin.isTTY) && !process.env.CI && !this.jsonEnabled()
}

protected async confirmOrFail(message: string, flags: {yes?: boolean}): Promise<void> {
  if (flags.yes) return
  if (!this.isInteractive()) {
    throw new CliError({exit: 3, code: 'CONFIRMATION_REQUIRED',
      message: `Confirmation required: ${message}`,
      hint: 'Re-run with --yes. Preview first with --dry-run.'})
  }
  const {confirm} = await import('@inquirer/prompts')          // lazy
  if (!(await confirm({message, default: false}))) {
    throw new CliError({exit: 9, code: 'CANCELLED', message: 'Cancelled.'})
  }
}

/** Call AFTER this.client(flags) so auth/region/project are validated. */
protected dryRun(flags, call: {method: string; http?: string; request: unknown}): never-ish
```
Apply to every mutating command (list in §2.1 plus `db delete --id`, `db update --id/--many`,
`db insert*`, `db replace`, `files upload/publish/unpublish`, `users block/invite/roles/policies`,
`webhooks *`, `scheduler enable/disable`, `payments enable/disable`, `*/archive`, `*/unarchive`,
`*/clone`, `config set/unset`, `env use`). Read-only commands do not get these flags.
Decide `destructive` per command (delete/stop/regenerate/block/disable = destructive → confirmation;
create/update/archive = mutating → `--dry-run` but no confirmation unless `--many`).

### 3.4 `norbix schema [command] --json`

New command `src/commands/schema.ts`. Source: `this.config.commands` (the oclif manifest). Output,
trimmed and stable:
```json
{ "cli": "norbix", "version": "x.y.z", "contract": "docs/agent-contract.md",
  "exitCodes": {...},
  "commands": [{ "id": "users delete", "description": "...", "destructive": true, "supportsDryRun": true,
     "args": [{"name":"id","required":true,"description":"User ID"}],
     "flags": [{"name":"yes","char":"y","type":"boolean","description":"..."},
               {"name":"project","type":"string","env":"NORBIX_PROJECT_ID","global":true}],
     "examples": ["norbix users delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run", "… --yes --json"] }],
  "dynamic": { "hub": "norbix hub <module> --help  |  norbix hub <module> --json lists methods", "api": "…" } }
```
Without `--json` print a compact table. For `hub`/`api`, extend scope help to list, per method, the
request field names + types (from the SDK `.d.ts` or a generated map — check what `@norbix.ai/ts`
exposes at runtime; if nothing, generate `src/generated/request-fields.json` in `scripts/`).

### 3.5 `hub` / `api` parser fixes (`src/lib/dispatch.ts`)

- Add `--body '<json>'` (or `-`) for the whole request object; when present, individual
  `--field` flags are rejected with exit 2 (no silent merge).
- Add `--field:str value` / `--field=@str:value` escape (or document that `--body` is the way to
  pass exact types) — pick one, document it in scope help and `schema.dynamic`.
- Boolean flag followed by a value: only treat the next token as a value if the field is not known
  to be boolean (needs the request-field map from §3.4) — otherwise document and keep.
- `--dry-run` must run after `this.client(flags)`.

### 3.6 `login`

Guard every prompt with `isInteractive()`. Non-interactive without `--password`/`--api-key` → exit
2 with hint listing the three non-interactive options (`--api-key`, `--user --password`,
`NORBIX_API_KEY` env). Remove the stack trace / unsettled-await warning.

### 3.7 Startup

`npm run build` also runs `oclif manifest` (keep `postpack` cleanup or commit the manifest — pick
one and document). Lazy-import `@inquirer/prompts` everywhere (only §3.3 helper and `login` need
it). Target: `norbix --version` < 200 ms; report before/after numbers.

### 3.8 Claude Code / agent integration deliverables (the "AI integration via CLI" part)

1. `docs/agent-contract.md` — §1 + §3.1 + §3.2, written for an agent to read once.
2. `docs/AGENTS.md` (also referenced from README "Use with AI coding agents"): the recipe an agent
   follows — auth with `--profile`/`NORBIX_*` env; always `--json`; discover with
   `norbix schema --json` then `norbix <cmd> --help`; mutate with `--dry-run` → inspect → `--yes`;
   branch on exit codes; prefer named commands, fall back to `hub`/`api` with `--body`.
3. `norbix ai init` (new command, name open — alternatives `norbix agent setup`): writes, into the
   current project, a Claude Code skill `.claude/skills/norbix/SKILL.md` (frontmatter name +
   description "Use when the task touches the Norbix backend…", body = short recipe + link to
   `norbix schema --json`) and optionally appends a 10-line block to `CLAUDE.md` / `AGENTS.md`
   (`--target claude|agents|cursor|all`, `--dry-run` shows the files it would write, never
   overwrites an existing file without `--force`). Keep the skill body short; the CLI's own
   `--help` and `schema` are the source of truth, not the skill file.
4. README section "Use with Claude Code / AI agents" (5–10 lines + `norbix ai init`).
5. Make sure the hub/portal docs team can link `docs/AGENTS.md` (ask Domantas where it will live;
   do not block on it).

## 4. Non-goals

- No MCP code in this branch (separate parallel work). Where the MCP server and the CLI should
  share things (exit-code table, error envelope, schema JSON), put them in `src/lib/` with no oclif
  imports so MCP can import them later, and say so in the final report.
- Do not remove or change human text output beyond what §1 requires. Do not add colour.
- No new runtime dependencies without saying why.

## 5. Order of work / PR split

PR 1 — Safety + errors (merge first, smallest reviewable unit):
  §3.1, §3.2, §3.3 applied to all destructive commands, §3.6, "Cancelled" → exit 9, tests (§7).
PR 2 — Discovery + dry-run everywhere: §3.4 `schema`, `--dry-run` on all mutating commands,
  `--help` examples with realistic values, §3.5.
PR 3 — Startup + agent integration: §3.7, §3.8 (docs, `ai init`, README).
Each PR: conventional commit titles (`feat(cli): …`, `fix(cli): …`; breaking → `feat!:`), CI green,
`COVERAGE.md` updated if it lists commands.

## 6. Reproduction harness (use before and after)

```bash
# fake server
cat > /tmp/mock.mjs <<'EOS'
import http from 'node:http'
http.createServer((req,res)=>{ console.error('MOCK',req.method,req.url); res.setHeader('content-type','application/json')
  if (req.url.includes('missing')) { res.statusCode=404; return res.end('{"message":"User not found","code":"USER_NOT_FOUND","traceId":"t-1"}') }
  if (req.url.includes('bad'))     { res.statusCode=400; return res.end('{"message":"Validation failed","errors":{"email":["is required"]}}') }
  if (req.url.includes('unauth'))  { res.statusCode=401; return res.end('{"message":"bad key"}') }
  res.end('{"ok":true}') }).listen(8799)
EOS
node /tmp/mock.mjs & export HOME=/tmp/h; mkdir -p $HOME/.norbix
printf '[x]\napi_key=k\nproject_id=p\napi_url=http://localhost:8799\nhub_url=http://localhost:8799\n[y]\napi_key=k\nproject_id=p\napi_url=http://localhost:1\nhub_url=http://localhost:1\n' > $HOME/.norbix/config
run(){ node bin/run.js "$@" </dev/null >/tmp/o 2>/tmp/e; echo "exit=$? stdout_lines=$(wc -l </tmp/o)"; head -c 400 /tmp/o; echo; head -c 300 /tmp/e; echo; }
run users delete abc123 --profile x            # must: exit 3, nothing sent, stderr names --yes
run db update orders --many --filter '{}' --update '{"$set":{"a":1}}' --profile x   # same
run users get missing --profile x --json       # must: exit 5, JSON envelope with status/code/traceId/hint
run users get bad --profile x --json           # must: exit 6, fieldErrors present
run users list --profile y --json              # must: exit 7, url present
run db update orders --profile x --json        # must: exit 2, envelope ≤ 30 lines
run nothing --json                             # must: exit 2, JSON envelope
run users delete abc123 --profile x --dry-run --json   # must: exit 0, request shown, nothing sent
time node bin/run.js --version
```

## 7. Acceptance tests to add (`tests/agent-mode.test.ts`, vitest, same fake-server approach)

- For every destructive command: non-TTY + no `--yes` → exit 3, request never hits the server.
- `--yes` non-TTY → request sent, exit 0.
- `--dry-run` → exit 0, nothing sent, output contains method + request; with a missing region →
  non-zero (proves context is resolved).
- JSON envelope shape and exit code for: 404, 400 w/ fieldErrors, 401, network, usage error, unknown
  command, bad `--filter` JSON. Assert `stdout` parses as a single JSON document and stderr is empty.
- Same exit code with and without `--json` for each case above.
- `norbix schema --json` lists every command in `dist/commands`, each with `destructive` and
  `supportsDryRun` booleans; snapshot test.
- `norbix ai init --dry-run` in a temp dir lists files; without `--dry-run` writes them; second run
  without `--force` refuses.

## 8. Report format (Domantas reads this; keep it in this order)

1. What was done (per PR, 3–6 lines each).
2. What was implemented — commands/flags/files, with a short before/after excerpt for the three
   most important behaviours (silent delete, JSON envelope, schema).
3. Where code moved / new files.
4. What was rejected or moved to a new ticket, and why (one line each) — e.g. parser items you
   chose not to change, `ai init` targets you skipped.
5. Harness output from §6 after the change (paste the `exit=` lines).
6. Open questions, each with your recommended default.
Refer to work by area (e.g. "db delete confirmation", "JSON error envelope") not by ticket codes.
Do not ask Domantas to test by hand unless you give an exact command list with expected output.

---

## 9. Work log (kept by the implementing agent)

### Goal

Make the CLI safe and predictable for a coding agent in a non-interactive
shell, and ship the Claude Code integration via the CLI. Not in scope: MCP
code (parallel work), colour, new runtime dependencies.

### Plan

1. PR 1 — safety + errors: exit-code table, error envelope, `confirmOrFail`
   on every destructive command, `--dry-run` captured in the SDK transport,
   `login`/`configure` guarded, "Cancelled" → exit 9, tests — **done**
2. PR 2 — discovery: `norbix schema`, `--dry-run` on every mutating command,
   realistic `--help` examples, hub/api parser fixes (`--body`, typed
   fields, boolean traps) — todo
3. PR 3 — startup (`oclif manifest` in build, lazy prompts), docs
   (`agent-contract.md`, `AGENTS.md`), `norbix ai init`, README section — todo

### Changes

| file | what changed | step |
|---|---|---|
| `src/lib/exit-codes.ts` | new: exit code table, `exitForStatus` (no oclif import, shareable with MCP) | 1 |
| `src/lib/cli-error.ts` | new: `CliError`, `toEnvelope`, `formatErrorText`, field-error and trace-id readers (no oclif import) | 1 |
| `src/lib/color.ts` | new: `colorEnabled` / `disableColorIfNeeded` (`--json`, `NO_COLOR`, pipe) | 1 |
| `src/hooks/init.ts`, `src/hooks/command-not-found.ts` | new oclif hooks: colour off, unknown command → envelope exit 2 | 1 |
| `src/base.ts` | `isInteractive`, `confirmOrFail`, `dryRunFlags` / `mutatingFlags`, dry-run middleware + recording proxy, `catch` → envelope, plain `logJson` | 1 |
| `src/lib/json.ts` | invalid JSON input → usage error (exit 2) with hint | 1 |
| 18 destructive command files | `confirmOrFail` instead of the `isTTY` prompt; `...BaseCommand.mutatingFlags` | 1 |
| `users block`, `scheduler disable`, `payments disable`, `webhooks disable`, `push integration disable` | now destructive: confirmation + `--yes` / `--dry-run` | 1 |
| `db delete --id`, `db update --many` | now ask for confirmation | 1 |
| `src/commands/login.ts`, `configure.ts` | every prompt guarded by `isInteractive()`; non-interactive → exit 2 with the flag options | 1 |
| `src/lib/namespace-command.ts`, `hub.ts`, `api.ts` | `--yes`/`--dry-run` parsed by oclif; context resolved before confirmation / dry run | 1 |
| `package.json` | `oclif.hooks` | 1 |
| `tests/_cli.ts`, `tests/agent-mode.test.ts`, `tests/cli-error.test.ts` | new: child-process tests against a fake gateway; envelope unit tests | 1 |
| `README.md` | "Errors and exit codes" section | 1 |

### Findings

- The SDK (`@norbix.ai/ts` 2.1.0) reads only `errorCode` from an error body,
  not `code`; and only an `errors` **array**, not an `errors` object map.
  The CLI envelope reads both forms itself (`cli-error.ts`). Left open in
  the SDK.
- The SDK wraps anything a middleware throws into `NorbixNetworkError`
  (`raw` = the thrown value). The dry-run stop is unwrapped from `raw` in
  `BaseCommand.catch`. Works, but a first-class "abort before fetch" hook in
  the SDK would be cleaner. Left open.
- The SDK retries GET/DELETE network errors (2 retries, 250 ms base); the
  dry-run client passes `retry: {maxRetries: 0}` so a dry run is instant.
- `users roles` / `users policies` are read-only lists (`getRoles`,
  `getPolicies`), although §3.3 lists them under mutating commands. No flags
  added.
- `logout` deletes the local session without confirmation. Local and
  reversible (`login`), left as is.
- `webhooks secret` (reveal, no `--rotate`) is read-only but shares the
  command with `--rotate`, so it carries `--yes` / `--dry-run` too.
- oclif's parser message carries boilerplate ("The following error occurred",
  "See more help with --help"); `toEnvelope` strips it.
- `--version` timings on this machine vary 0.5 s – 3.2 s between runs
  (heavy load); the before/after numbers in the report use the best of
  several runs.

### Rejected / moved out

- (none yet)

### Needs you

- (none)

### Open questions

- (none blocking)
