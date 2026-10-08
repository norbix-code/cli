# The agent contract

What a script or a coding agent (Claude Code, Cursor, Codex, OpenCode) can
rely on when it runs `norbix` from a shell. Read it once; every error the CLI
prints points back here through its `hint` and `docs` fields.
`norbix schema --json` names this file too.

## 1. The rules

1. **Never hang, never act silently.** In a non-interactive shell (stdout or
   stdin is not a terminal, or `CI` is set, or `--json` is passed) a command
   that needs a confirmation and did not get `--yes` exits **3** with one
   line on stderr that names `--yes`. It sends nothing. In a terminal
   without `--yes` it asks, as before.
2. **`--json` means stdout is exactly one JSON document, always.** Success:
   the result. Failure: `{"error": {...}}` (section 3). No text on stdout in
   JSON mode, ever. Progress and warnings go to stderr. The exit code is the
   same with and without `--json`.
3. **Errors carry everything the SDK knows** — `status`, `code`,
   `fieldErrors`, `context`, `url`, `traceId` — plus a `hint` (what to do next) and
   `docs` (`norbix <command> --help` or a URL).
4. **Documented exit codes** (section 2). Branch on them.
5. **`--dry-run` on every mutating command.** It resolves auth, region and
   project exactly as a real call would (so a dry run that would fail for
   real fails here too), prints the request that would be sent, sends
   nothing, exits 0.
6. **Discoverable without reading source.** `norbix schema --json` returns
   the whole command surface (args, flags, types, required, env var,
   default, examples, `destructive`, `supportsDryRun`); `norbix schema
   <command> --json` one command. `--help` on every command has an example
   with real-looking values and, for mutating commands, the `--dry-run` /
   `--yes` pattern. `norbix hub <module> --json` lists the SDK methods with
   their request fields.
7. **Cheap to run.** `norbix --version` answers in well under 200 ms;
   prompts and other heavy modules load only when used.
8. **No ANSI codes** with `--json`, with `NO_COLOR` set, or when stdout is
   not a terminal.

## 2. Exit codes

| code | meaning | what to do |
|---|---|---|
| 0 | success | |
| 1 | unexpected / internal error | file an issue, include `traceId` |
| 2 | usage: bad flags or args, invalid JSON input, unknown command, missing config | `norbix <command> --help` / `norbix schema <command> --json` |
| 3 | confirmation required (non-interactive shell, no `--yes`) | re-run with `--yes` after a `--dry-run` |
| 4 | not authenticated / auth rejected (401, 403, no key); a browser sign-in denied (`ACCESS_DENIED`), not approved in time (`EXPIRED_TOKEN`), refused by the Hub (`INVALID_GRANT`, `INVALID_REQUEST`) or ended (`SESSION_EXPIRED`); `login --wait` not approved yet (`AUTHORIZATION_PENDING` — run it again) | `norbix login` (agents: `--no-browser --json`, then `--wait`), `--api-key`, `--profile`, `NORBIX_API_KEY` |
| 5 | not found (404) | check the id, `--env`, `--project` |
| 6 | validation rejected by the server (400 / 422, or a 200 with `isSuccess: false`) | `fieldErrors` lists the fields |
| 7 | network / timeout / endpoint unreachable | the error shows the URL; check `--host`, `--region`, connectivity |
| 8 | rate limited / server error (429, 5xx) | retry with backoff; include `traceId` |
| 9 | cancelled by the user at a prompt | |

Exit codes are identical with and without `--json`. The table is also in
`norbix schema --json` under `exitCodes`, and in code at
`src/lib/exit-codes.ts`.

## 3. The JSON error envelope

One document on stdout, nothing on stderr:

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found",
    "status": 404,
    "exit": 5,
    "fieldErrors": {"email": ["is required"]},
    "url": "https://nb-eu-germany.api.norbix.ai/v3/membership/auth/66b2f0a1c3d4e5f6a7b8c9d0",
    "traceId": "7f3c…",
    "hint": "Check the id, the --env and the --project. List items first (e.g. `norbix users list --json`).",
    "docs": "norbix users get --help"
  }
}
```

- `code` — the gateway's or the SDK's own code when there is one
  (`CM-ERRORS-FILES-016`, `NORBIX_NETWORK_ERROR`), else derived from the
  category (`NOT_FOUND`, `USAGE_ERROR`, `CONFIRMATION_REQUIRED`,
  `UNKNOWN_COMMAND`, `CANCELLED`, `INTERNAL_ERROR`).
- `status` — HTTP status, only when the server answered.
- `exit` — the process exit code (section 2).
- `fieldErrors` — only when the server named fields: `{field: [messages]}`.
- `context` — only when the gateway attached extra values to the error
  (`context` on the error item), e.g. `{"missingPermissions": "files:public"}`
  with `CM-ERRORS-MEMBERSHIP-039`. In text mode each value is a
  `context.<key>: <value>` line.
- `url` — the URL that was called, when known (network errors always have it).
- `traceId` — when the server returned one (`traceId`, `correlationId`,
  or `responseStatus.meta.correlationId`).
- `hint`, `docs` — always present.

Without `--json` the same information goes to **stderr** as text:

```
Error: User not found
  code: USER_NOT_FOUND
  status: 404
  url: https://…/v3/membership/auth/66b2f0a1c3d4e5f6a7b8c9d0
  traceId: 7f3c…
Hint: Check the id, the --env and the --project. …
Docs: norbix users get --help
```

## 4. What a dry run prints

```json
{
  "dryRun": true,
  "method": "api.membership.deleteUser",
  "request": {"id": "66b2f0a1c3d4e5f6a7b8c9d0"},
  "http": {
    "method": "DELETE",
    "url": "https://nb-eu-germany.api.norbix.ai/v3/membership/auth?id=66b2f0a1c3d4e5f6a7b8c9d0",
    "headers": {"accept": "application/json", "authorization": "Bearer ***", "norbix-project-id": "…"},
    "body": null
  }
}
```

`method` is the SDK call (or a local action such as `config.set`); `http` is
the request as it would leave the machine, with the token redacted. A
command that makes several calls (`files upload`) shows the first.

## 5. Which commands confirm, which dry-run

- **Destructive** (`destructive: true` in the schema; take `--yes` and
  `--dry-run`): `delete`, `stop`, `regenerate`, `rotate`, `block`,
  `disable`, `remove`, `db update --many`, `db delete`, and any `hub` /
  `api` method whose verb is one of those.
- **Mutating** (`supportsDryRun: true`, no confirmation): `create`,
  `insert`, `update --id`, `replace`, `archive`, `unarchive`, `clone`,
  `enable`, `invite`, `unblock`, `upload`, `publish`, `unpublish`,
  `config set / unset`, `env use`, `logout`, `raw`.
- **Read-only**: everything else; no `--yes`, no `--dry-run`.

## 6. Shared code

`src/lib/exit-codes.ts`, `src/lib/cli-error.ts` (envelope),
`src/lib/schema.ts` (schema document) and `src/lib/request-fields.ts`
(SDK method → request fields) have no oclif dependency, so the MCP server
can import them and speak the same contract.
