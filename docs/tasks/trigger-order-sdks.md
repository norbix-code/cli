# SDKs + CLI: trigger "order" and "break on failure"
This file: /Users/djovaisas/Projects/norbix/worktrees/cli/feat/trigger-order/docs/tasks/trigger-order-sdks.md (branch feat/trigger-order; after the merge: norbix-code/cli main, `docs/tasks/trigger-order-sdks.md`)
Gateway half (shipped): /Users/djovaisas/Projects/norbix/worktrees/gateway/feat/trigger-order-break/docs/tasks/trigger-order-break.md (merged into refactoringV2, 251fbc72a)

## Goal
Every SDK and the CLI know the two new trigger fields `order` (whole number, optional) and `breakOnError` (true / false) on the trigger save request, the trigger read DTO and the trigger list row.
Not in scope: AI trigger methods in the SDKs (none exist today); the uncompiled `references/` folders; React-Redux (its hooks pass arguments straight to `@norbix.ai/ts`).

## Decisions
- decision(sdks:types): typed SDKs (TypeScript, .NET, Go) get the fields in their generated hub / api types; their save methods already take the whole request, so no method changed.
- decision(sdks:untyped): Python, Dart, Kotlin and Swift send a plain map, so the fields already reached the gateway; they get docs with an example, and Python (the only one with trigger tests) a body test.
- decision(sdks:mcp): the MCP manifest is rebuilt from the released TypeScript SDK, so `norbix_describe_endpoint` shows the fields to an assistant.
- decision(cli:db): the CLI already saves schema triggers from a JSON file (`db trigger create --file`), which passes the fields through; it gets `--order` and `--[no-]break-on-error` flags that win over the file. `payments triggers` / `payments trigger` print the raw answer, so they show the fields with no change.
- decision(gateway:triggers): owner, 2026-10-08 — a pre-action code that throws does not stop the queue (kept as is; recorded in the gateway task file).

## Plan
1. [done] docs(cli:tasks): this task file
2. [done] gen(sdk-ts:types): `order` / `breakOnError` + `IQueuedTrigger` in `hub2.dtos.ts` and `api2.dtos.ts`; test for all four saves — released 4.18.0
3. [done] gen(sdk-net:types): `Hub.dtos.cs` / `Api.dtos.cs` regenerated; 8 body snapshots show the fields — released 3.16.0
4. [done] gen(sdk-go:types): `norbix/{hub,api}/dtos/dtos.go` regenerated; save + decode tests — released 2.18.0
5. [done] docs(sdk-python, sdk-dart, sdk-kotlin, sdk-swift): the fields on the trigger docs with an example; Python body test for all four saves
6. [done] release(sdks): seven pull requests merged (list below)
7. [done] gen(sdk-mcp:manifest): rebuilt from `@norbix.ai/ts` 4.18.0, describe test — released 0.5.0
8. [done] feat(cli:db): `db trigger create --order <n> --[no-]break-on-error`; `@norbix.ai/ts` ^4.18.0; docs/database.md
9. [done] release(cli): this file ships with the CLI pull request, merged last (after @norbix.ai/ts 4.18.0)

## Shipped
| repo | pull request | release |
|---|---|---|
| sdk-ts | https://github.com/norbix-code/sdk-ts/pull/83 | v4.18.0 |
| sdk-net | https://github.com/norbix-code/sdk-net/pull/85 | v3.16.0 |
| sdk-go | https://github.com/norbix-code/sdk-go/pull/33 | v2.18.0 |
| sdk-python | https://github.com/norbix-code/sdk-python/pull/43 | none (docs + test) |
| sdk-dart | https://github.com/norbix-code/sdk-dart/pull/33 | none (docs) |
| sdk-kotlin | https://github.com/norbix-code/sdk-kotlin/pull/31 | none (docs) |
| sdk-swift | https://github.com/norbix-code/sdk-swift/pull/32 | none (docs) |
| mcp | https://github.com/norbix-code/mcp/pull/14 | v0.5.0 |
| cli | the pull request that carries this file | the release made when it merges |

## Evidence
| repo | check | result |
|---|---|---|
| sdk-ts | `vitest run`, `tsc --noEmit`, lint, prettier | 927 / 927 (5 new), clean |
| sdk-net | `dotnet test Norbix.Sdk.sln` | 316 / 316 (8 snapshots now show both fields in the request bodies) |
| sdk-go | `go build ./... && go test ./...`, `go vet`, `gofmt -l` | green; 2 new tests (save sends order 0 + flag; typed read decodes both) |
| sdk-python | `uv run pytest`, `make typecheck` | green; 4 new (one per save method) |
| mcp | `npm test`, `tsc --noEmit` | 39 / 39 (1 new) |
| cli | `npm test` (after `npm run build`), `tsc --noEmit` | 862 / 862 (4 new + command-schema snapshot) |

## Changes
| file (repo, branch) | what changed | step |
|------|--------------|------|
| sdk-ts `src/types/hub2.dtos.ts`, `src/types/api2.dtos.ts` (main via #83) | the two fields on `SaveTriggerRequest`, `TriggerDto`, `TriggerProjectionList`; `IQueuedTrigger` | 2 |
| sdk-ts `tests/hub/trigger-order.test.ts` (main via #83) | new test | 2 |
| sdk-net `src/Norbix.Sdk.Types/Generated/{Hub,Api}.dtos.cs` + 8 `tests/Norbix.Hub.Tests/test_results/*.verified.txt` (main via #85) | regenerated + snapshots | 3 |
| sdk-go `norbix/{hub,api}/dtos/dtos.go`, `norbix/hub/trigger_order_test.go` (main via #33) | regenerated + test | 4 |
| sdk-python `docs/hub/triggers.md`, `README.md`, `tests/hub/test_trigger_order.py` (main via #43) | docs + test | 5 |
| sdk-dart / sdk-kotlin / sdk-swift `README.md` (main via #33 / #31 / #32) | docs with an example | 5 |
| mcp `src/manifest/dtos.{hub,api}.json`, `package.json`, `tests/generic.test.ts` (main via #14) | manifest + bump + test | 7 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/trigger-order/src/commands/db/trigger/create.ts (feat/trigger-order) | `--order`, `--[no-]break-on-error` | 8 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/trigger-order/tests/db-routes.test.ts (feat/trigger-order) | 4 new tests; `tests/__snapshots__/schema.test.ts.snap` | 8 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/trigger-order/docs/database.md (feat/trigger-order) | the flags, the queue rule, an example | 8 |

## Findings

fix(sdk-ts:tooling): the TypeScript types could not be regenerated — the private `scripts/sync-types.mjs` (gitignored, only in the main checkout) writes its `@sdk-dto-patches` block outside the namespace, so the output does not compile (`tsc`: no exported member `UpdateUserNotificationsPreferences`, `GrantContactConsentRequest`, `UnsubscribeContactRequest`, …), and `scripts/generate-endpoints.mjs` fails at start (`Cannot access 'OPTIONAL_AUTH_ROUTES' before initialization`). The two fields were applied by hand in the generator's exact output shape (diff: 37 lines, only the trigger fields) — left open, known follow-up #60
    where: /Users/djovaisas/Projects/norbix/sdks/norbix-js/scripts/sync-types.mjs (not in git — gitignored)
```ts
// regenerated hub2.dtos.ts, end of file (sync-types --remote, 2026-10-08) — does not compile
}                                                   // <-- here: the namespace closes …
// @sdk-dto-patches (injected by sync-types.mjs)
export class UserApiKey {                           // <-- … and the patch classes land outside it
```

fix(sdk-go:types): every number in the Go DTOs is a plain `float64` with `omitempty`, so on a decoded `TriggerDto` an order of 0 and "no order" look the same (both `0`). Sending works (requests are maps, order 0 reaches the gateway — tested). Making optional numbers `*float64` is a generator-wide change in typegen `languages/go/generate.py` — left open
    where: https://github.com/norbix-code/sdk-go/blob/main/norbix/hub/dtos/dtos.go
```go
// norbix-go norbix/hub/dtos/dtos.go (main) — generated
	Order          float64           `json:"order,omitempty"`      // <-- here: 0 and "no order" are the same value
	BreakOnError   bool              `json:"breakOnError,omitempty"`
```

chore(sdks:tooling): the regeneration tools of several SDKs are not in git — Python (`scripts/generate_endpoints.py`), Dart (`tool/generate_resources.py`), Kotlin (none), the TypeScript scripts above; typegen has generators for C# and Go only, and `tools/sync.py` named in its README does not exist — left open
    where: /Users/djovaisas/Projects/norbix/sdks/typegen/README.md

chore(sdks:ai-triggers): no SDK has AI trigger methods and no `AiTriggerRequest` type is emitted (only `SaveAiProjectTrigger` and `AiTriggerDto`); AI triggers are reachable through the generic calls only — left open
    where: https://github.com/norbix-code/sdk-ts/blob/main/src/hub/ai.ts

chore(git:sdks): main checkouts of typegen, cli, python, dart, kotlin, swift are on feature branches (nbx-doctor WARN); another session was shipping Swift and the CLI at the same time — not mine, untouched
    where: /Users/djovaisas/Projects/norbix/sdks

## Rejected / moved out
- decision(sdk-ts:tooling): fixing the private sync / endpoint scripts — moved out — tooling outside the task, not in git; recorded under Findings
- decision(cli:triggers): trigger save commands for membership / files / payments in the CLI — rejected — the CLI has only `db trigger create`; new commands are their own feature
- decision(sdk-react-redux): no change — hooks pass through to `@norbix.ai/ts` (peer `>=4.11.0`), so 4.18.0 carries the fields

## Needs you
- (nothing)

## Open questions
- (none)
