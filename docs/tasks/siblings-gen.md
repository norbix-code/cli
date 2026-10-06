# siblings-gen — regenerate SDK and cloud types after the sibling fixes
This file: /Users/djovaisas/Projects/norbix/sdks/cli/docs/tasks/siblings-gen.md (branch main, shipped from docs/siblings-gen)

Owner decision 2026-10-06 (product owner): regenerate the SDK types and the cloud DTOs (Data Transfer Objects — the plain request / response classes) from gateway `refactoringV2` at or after `b8fb4152a`, so the clients get the new response fields from the sibling-fix work. Tracker: /Users/djovaisas/Projects/norbix/gateway/docs/tasks/database-siblings.md (branch refactoringV2), "Needs you" item `gen(sdk:types)` (ref: siblings-templates-env-1).

## Goal
Every client (sdk-ts, sdk-net, sdk-go, sdk-swift and sdk-dart references, cloud) carries the response fields the gateway serves today — `env` on the payments webhook received-event row and on tenant log entries, and on templates — with no public SDK method changed.

Not in scope: new SDK methods; norbix-python / norbix-kotlin / norbix-react-redux / norbix-mcp (not in the owner's list — see Findings); gateway changes; the typegen generator itself (it needed no fix).

## Plan
1. [done] chore(gateway:tmp:hosts): tmp gateway worktree from origin/refactoringV2 `b8fb4152a`; Community.Hub and Community.Api run with plain `dotnet run --no-build` on free ports (never 5001 / 5002 / 3000); URLs read from `.local/state/ports/*.url`
    where: /Users/djovaisas/Projects/norbix/worktrees/gateway/tmp-siblings-gen (detached at b8fb4152a) — removed at the end
2. [done] chore(typegen:coverage): Routine C — endpoint manifests emitted into the typegen worktree (`NORBIX_SDK_COVERAGE_DIR`), `build_matrix.py` run against `origin/main` of every SDK (`NORBIX_SDK_ROOT` = a scratch folder of detached worktrees) — no diff, nothing to commit; the generator needed no fix
    where: /Users/djovaisas/Projects/norbix/worktrees/typegen/gen/siblings-env-fields (branch gen/siblings-env-fields, no commits) — removed at the end
3. [done] feat(sdk-ts:types): `src/types/{hub2,api2}.dtos.ts` + `hub2.contract.json` regenerated (`npm run sync-types -- --remote` with typegen's `languages/typescript/reference/sync-types.mjs`, then prettier) — shipped PR https://github.com/norbix-code/sdk-ts/pull/78, release v4.13.0 (main d0a44eb)
    where: /Users/djovaisas/Projects/norbix/sdks/norbix-js (branch main)
4. [done] feat(sdk-net:types): `src/Norbix.Sdk.Types/Generated/Hub.dtos.cs` regenerated (typegen `languages/csharp/generate.py`) — shipped PR https://github.com/norbix-code/sdk-net/pull/80, release v3.11.0 (main 9e45de6)
    where: /Users/djovaisas/Projects/norbix/sdks/norbix-net (branch main)
5. [done] feat(sdk-go:types): `norbix/hub/dtos/dtos.go` regenerated (typegen `languages/go/generate.py`) — shipped PR https://github.com/norbix-code/sdk-go/pull/29, release v2.14.0 (main 23a775a)
    where: /Users/djovaisas/Projects/norbix/sdks/norbix-go (branch main)
6. [done] chore(sdk-swift:types): `references/{hub,api}.dtos.swift` + `references/{hub2,api2}.dtos.ts` regenerated in place (`x swift <file>` / `x typescript <file>`) — shipped PR https://github.com/norbix-code/sdk-swift/pull/25 (main 83a49b7), no release (chore)
    where: /Users/djovaisas/Projects/norbix/sdks/norbix-swift (branch main)
7. [done] chore(sdk-dart:types): `references/{hub,api}.dtos.dart` regenerated in place (`x dart <file>`) — shipped PR https://github.com/norbix-code/sdk-dart/pull/28 (main 8243b22), no release (chore)
    where: /Users/djovaisas/Projects/norbix/sdks/norbix-dart (branch main)
8. [done] gen(cloud:types): `src/types/{hub2,api2}.dtos.ts` regenerated in place (`x typescript <file>`, BaseUrl put back, `node scripts/fix-dto-types.mjs`) — shipped `face90e1` on refactoring1 (direct flow)
    where: /Users/djovaisas/Projects/norbix/cloud (branch refactoring1)
9. [done] docs(cli:tasks): this file — shipped through a cli pull request (the report lives in the cli repo, runbook rule 7)

Decision (step 3–7): the owner's brief said commit `gen(types): …`, but every SDK's `PR title` check allows only `feat|fix|perf|refactor|docs|chore|test|ci|style|build|revert` (/Users/djovaisas/Projects/norbix/sdks/norbix-js/.github/workflows/pr-title.yml:39, branch main). So: `feat(types)` where the types ship in the package (ts, net, go → a minor release, clients get the fields), `chore(types)` where only the non-compiled `references/` changed (swift, dart → no release). Cloud has no such check and keeps `gen(cloud:types)`.

## Field diff (what the regenerate shows)
The same two additive response fields in every generated file; nothing removed from any request or response type.

| Type | Field | sdk-ts / cloud | sdk-net | sdk-go | swift / dart references |
|---|---|---|---|---|---|
| `PaymentsWebhookLogEntry` (payments webhook received-event row) | env | `env?: string` | `string? Env` | `Env string \`json:"env,omitempty"\`` | `env:String?` / `String? env` |
| `TenantLogEntryDto` (logging per env) | env | `env: string` | `[DataMember] string Env` | `Env string \`json:"env,omitempty"\`` | `env:String?` / `String env = ""` |
| `TemplateDto`, `TemplateListProjection` (templates per env) | env | already present (Database last-wave regenerate, 2026-10-05) | already present | already present | already present |

Excerpt, sdk-go `norbix/hub/dtos/dtos.go`:
```diff
 type PaymentsWebhookLogEntry struct {
+	Env             string  `json:"env,omitempty"`
 ...
 type TenantLogEntryDto struct {
+	Env           string            `json:"env,omitempty"`
```
Excerpt, cloud `src/types/hub2.dtos.ts`:
```diff
     export class PaymentsWebhookLogEntry
+        public env?: string;
 ...
     export class TenantLogEntryDto
+        // @DataMember
+        public env: string;
```
Other changes: the Api files changed only in the `Date:` header line (sdk-net and sdk-go Api files were byte-identical). sdk-ts `hub2.contract.json` drops six internal message types the host no longer exports (`IngestSourceMessage`, `ProcessCollectionImport`, `TermInserted`, `TermUpdated`, `TermDeleted`, `TermsDeleted`) — the `.dtos.ts` file had already lost them on 2026-10-05; no SDK method used them. Class counts in cloud unchanged (hub2 1373, api2 211), no `ReadonlyArray`.

## Tests
| Repo | Command | Result |
|---|---|---|
| sdk-ts | `npx vitest run` · `npm run typecheck` · `npm run lint` · `npx prettier --check .` | 874/874 (52 files) · green · green · green; CI green |
| sdk-net | `dotnet test Norbix.Sdk.sln` (NuGet audit on) | Norbix.Sdk.Tests 66/66, Norbix.Hub.Tests 218/218; CI green |
| sdk-go | `go build ./... && go test ./...` · `go vet ./norbix/...` · `gofmt -l .` | 5 packages ok, 119 top-level tests · clean · empty; CI green |
| sdk-swift | `swift build` · `swift test` | build ok · 86 XCTest tests, 0 failures; CI `swift test` macos-14 / macos-26 green |
| sdk-dart | `dart test` | 327 passed |
| cloud | `npm run build` · `npm run tests` | green · 1151 passing, 6 failing (the 6 `explainCron` tests that already fail on refactoring1) |

## Changes
| file (absolute, branch) | what changed | step |
|------|--------------|------|
| /Users/djovaisas/Projects/norbix/sdks/norbix-js/src/types/hub2.dtos.ts (main) | env on PaymentsWebhookLogEntry, TenantLogEntryDto; date | 3 |
| /Users/djovaisas/Projects/norbix/sdks/norbix-js/src/types/api2.dtos.ts (main) | date only | 3 |
| /Users/djovaisas/Projects/norbix/sdks/norbix-js/src/types/hub2.contract.json (main) | six internal message types removed | 3 |
| /Users/djovaisas/Projects/norbix/sdks/norbix-net/src/Norbix.Sdk.Types/Generated/Hub.dtos.cs (main) | Env on the two types | 4 |
| /Users/djovaisas/Projects/norbix/sdks/norbix-go/norbix/hub/dtos/dtos.go (main) | Env on the two types | 5 |
| /Users/djovaisas/Projects/norbix/sdks/norbix-swift/references/hub.dtos.swift, hub2.dtos.ts, api.dtos.swift, api2.dtos.ts (main) | env on the two types; Api files date only | 6 |
| /Users/djovaisas/Projects/norbix/sdks/norbix-dart/references/hub.dtos.dart, api.dtos.dart (main) | env on the two types (field, constructor, fromMap, toJson); Api file date only | 7 |
| /Users/djovaisas/Projects/norbix/cloud/src/types/hub2.dtos.ts, api2.dtos.ts (refactoring1) | env on the two types; api2 date only | 8 |
| /Users/djovaisas/Projects/norbix/sdks/cli/docs/tasks/siblings-gen.md (main) | this file | 9 |

## Findings
- chore(gateway:docs:tasks): the brief points at "Plan 13" of database-siblings.md, but that tracker has Plan steps 1–8 only; the regenerate is its "Needs you" item `gen(sdk:types)` — that item can be ticked with this file — open (tracker edit is the gateway's)
    where: /Users/djovaisas/Projects/norbix/gateway/docs/tasks/database-siblings.md:111 (branch refactoringV2)
- chore(sdks:runbook): the "Regenerating an SDK's types" table is out of date — sdk-ts `npm run sync-types` (no `--remote`) copies from `../../cloud`, which does not resolve from a worktree; both `scripts/sync-types.mjs` (sdk-ts) and `scripts/sync_types.py` (sdk-swift) are gitignored, so a fresh worktree has no script and the copy in the main checkout of sdk-ts is an older version (it puts the `@sdk-dto-patches` block outside the module); the current script is typegen's `languages/typescript/reference/sync-types.mjs`; sdk-dart `make gen` calls `tool/generate_resources.py`, which does not exist; the go / csharp generators read the live gateway (`--api-url` / `--hub-url`), not `core/contract.json` — open
    where: /Users/djovaisas/Projects/norbix/gateway/docs/tasks/sdk-management.md ("Regenerating an SDK's types", branch refactoringV2)
- chore(typegen:coverage): `build_matrix.py` run from a typegen worktree scans the SDK main checkouts, several of which sit on old feature branches (swift, dart, python, kotlin, cli); that gave a false 503-line matrix diff (e.g. Swift 425 → 316). Scanning `origin/main` (`NORBIX_SDK_ROOT`) gave no diff. The matrix should scan `origin/main`, not whatever the checkout holds — open
    where: /Users/djovaisas/Projects/norbix/sdks/typegen/coverage/sdk_root.py (branch main)
- chore(sdks:references): norbix-kotlin (`references/{api,hub}.dtos.kt`) and norbix-python (`references/*_dtos.py`, `*2.dtos.ts`) also carry generated references that now lack the two env fields — not in the owner's list, left — open
    where: /Users/djovaisas/Projects/norbix/sdks/norbix-kotlin/references, /Users/djovaisas/Projects/norbix/sdks/norbix-python/references (branch main)
- chore(gateway:hosts): a Community host started in a worktree subscribes to the shared local EventStore and catches up (many `carries no 'nb-account-id'` WARN lines at start); it was run only as long as the generators needed it — open, no action taken
    where: /Users/djovaisas/Projects/norbix/worktrees/gateway/tmp-siblings-gen (removed)
- chore(typegen:checkout): the typegen main checkout is on `fix/go-references-build-ignore` with an untracked `coverage/` folder, so it has no `languages/go/generate.py` / `languages/csharp/generate.py` — work was done in a typegen worktree from origin/main; checkout left untouched (not mine)
    where: /Users/djovaisas/Projects/norbix/sdks/typegen (branch fix/go-references-build-ignore)
- chore(sdks:checkouts): main checkouts not on main — sdk-swift `fix/hub-optional-project`, sdk-dart `chore/ci-release-fixes`, cli `fix/sdk-1.3-and-deps`, cloud `audit/push` (125 changed files) — left untouched (not mine)

## Rejected / moved out
- `gen(types): …` commit type for the SDKs — the SDK PR-title check refuses it; used `feat(types)` / `chore(types)` instead (see the decision under Plan).
- `npm run generate-endpoints` in sdk-ts — only response fields changed, no endpoint; not run.

## Needs you
- [ ] Nothing blocking. Optional: tick the tracker's "Needs you" item `gen(sdk:types)` in /Users/djovaisas/Projects/norbix/gateway/docs/tasks/database-siblings.md (branch refactoringV2) with: sdk-ts v4.13.0, sdk-net v3.11.0, sdk-go v2.14.0, cloud `face90e1`, sdk-swift #25, sdk-dart #28.

## Open questions
