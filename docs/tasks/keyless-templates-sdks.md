# Keyless cloud connections — setup templates — SDKs, CLI and MCP

## Goal

Bring the SDKs, the CLI and the MCP server up to step 7 of keyless cloud connections (gateway
branch `feat/keyless-templates` at e51a450cf, contract `gateway/docs/tasks/keyless-cloud-connections.md`):
`GetKeylessIntegrationSetupResponse` gains `templates?: KeylessIntegrationSetupTemplate[]`
(`{ kind, fileName, content }`, kind = `cloudformation` | `bicep` | `terraform`).

Not in scope: pull requests, releases, raising `@norbix.ai/ts` in mcp / cli / react-redux.

## Plan

1. Routine C into a typegen worktree + raw contract — **done**
2. Types: norbix-js, norbix-net, norbix-go, norbix-dart / norbix-kotlin references — **done**
3. `templates` passed through and documented on every hand-written `getKeylessIntegrationSetup`;
   each keyless test's fake answer carries one template and asserts it comes back — **done**
4. CLI `norbix integrations keyless-setup`: template file names in the normal output, `--template <kind>` — **done**
5. MCP manifest from the js worktree; curated tool description names templates — **done**
6. Full tests / lint / typecheck per repo — **done**, all green
7. This report — **done**

## Changes

Every branch is `feat/keyless-templates` from `origin/main` (`sdks/scripts/worktree/new.sh`), pushed, no pull request.
Private gateway: Hub `http://127.0.0.1:53984`, Api `http://127.0.0.1:53983`.

| Repo · worktree | Commits | What changed | Step |
|---|---|---|---|
| typegen · /Users/djovaisas/Projects/norbix/worktrees/typegen/feat/keyless-templates | f495f95 | `core/contract.raw.{hub,api}.json` (api: base URL only). Endpoint manifests and matrix byte-identical (no new route) | 1 |
| norbix-js · /Users/djovaisas/Projects/norbix/worktrees/norbix-js/feat/keyless-templates | a9ea450, 1c383a0 | `src/types/hub2.dtos.ts` (header switched to the private address and back; api2 date only, not committed); `docs/hub/integrations.md` hand-written block (kept by `generate-endpoints`); `tests/keyless-setup.test.ts` | 2, 3 |
| norbix-net · /Users/djovaisas/Projects/norbix/worktrees/norbix-net/feat/keyless-templates | 1b85510, 025c9e1 | `Generated/Hub.dtos.cs`; README (integrations row + keyless section); `HubKeylessSetupTests` + its snapshot; `EndpointCoverageTests.Hub.Integrations` snapshot (new response field) | 2, 3 |
| norbix-go · /Users/djovaisas/Projects/norbix/worktrees/norbix-go/feat/keyless-templates | 2e99217, e9c7322 | `norbix/hub/dtos/dtos.go`; method comment, README; test compares with `reflect.DeepEqual` (a struct with a slice cannot use `!=` — the old test would not compile) | 2, 3 |
| norbix-python · /Users/djovaisas/Projects/norbix/worktrees/norbix-python/feat/keyless-templates | deab892 | docstring, `docs/hub/integrations.md`, test (dict pass-through) | 3 |
| norbix-dart · /Users/djovaisas/Projects/norbix/worktrees/norbix-dart/feat/keyless-templates | 740dd29, 3952812 | `references/hub.dtos.dart` (`x dart`); method comment, README, test (map) | 2, 3 |
| norbix-kotlin · /Users/djovaisas/Projects/norbix/worktrees/norbix-kotlin/feat/keyless-templates | 3103df2, 2c73be2 | `references/hub.dtos.kt` (`x kotlin`); method comment, README, test (map) | 2, 3 |
| norbix-swift · /Users/djovaisas/Projects/norbix/worktrees/norbix-swift/feat/keyless-templates | 364ad2e | method comment, README, test (dictionary) | 3 |
| norbix-react-redux · /Users/djovaisas/Projects/norbix/worktrees/norbix-react-redux/feat/keyless-templates | 518032d | hook comment, README, test (fake client answers with a template) | 3 |
| cli · /Users/djovaisas/Projects/norbix/worktrees/cli/feat/keyless-templates | ca89496 + this report | `src/commands/integrations/keyless-setup.ts` (`templates` in the CLI's own `KeylessSetup`, file list in the human view, `--template cloudformation\|bicep\|terraform`), tests (+5), schema snapshot (`template:option`), README, COVERAGE.md | 4 |
| norbix-mcp · /Users/djovaisas/Projects/norbix/worktrees/norbix-mcp/feat/keyless-templates | ffebcce, b62eef3 | `src/manifest/dtos.hub.json` (`NORBIX_JS_DIR=<js worktree> npm run generate-manifest`); `norbix_get_keyless_integration_setup` description; README; test (+1) | 5 |

Nothing removed: every generated diff (raw contract, js, .NET, Go, Dart, Kotlin, MCP manifest) only adds
`KeylessIntegrationSetupTemplate` and the `templates` field; the route summary now says "script, templates".

`--template <kind>` prints only the file content (a final new line added when missing), so
`norbix integrations keyless-setup files aws --template terraform > norbix-files.tf` works; with `--json`
it returns the one template; a kind the answer lacks fails with the kinds it has. The CLI reads the answer
through its own `KeylessSetup` interface, so it compiles and runs on the released `@norbix.ai/ts` 4.40.0 —
no local js build was needed and it does not wait for the js release.

### Test results

| Repo | Command | Result |
|---|---|---|
| norbix-js | `vitest run` · `npm run lint` · `prettier --check .` · `tsc --noEmit` · `build` + `typecheck:dist` | 72 files, 1148 passed · clean · clean · clean · clean |
| norbix-net | `dotnet test Norbix.Sdk.sln` | Sdk.Tests 111, Hub.Tests 279, Coexistence 2 — all passed |
| norbix-go | `go build ./...` · `go vet ./norbix/...` · `gofmt -l .` · `go test ./...` | clean · clean · clean · 204 top-level passed, 0 failed |
| norbix-python | `uv run pytest` · `make lint` · `make typecheck` | 1235 passed · clean · clean |
| norbix-dart | `dart analyze` · `dart test` | no issues · 511 passed |
| norbix-kotlin | `./gradlew test` | 331 passed |
| norbix-swift | `swift test` | 143 passed |
| norbix-react-redux | `vitest run` · `tsc --noEmit` · `npm run lint` · `prettier --check` (changed files) | 505 passed · clean · clean · clean |
| cli | `npm test` · `tsc --noEmit` | 48 files, 1217 passed · clean |
| norbix-mcp | `npm test` · `tsc --noEmit` · `npm run build` | 98 passed · clean · clean |
| typegen | `build_matrix.py` · `check_route_drift.py` (source / `--contract`), `NORBIX_SDK_ROOT` = links to these worktrees | no change · 89 / 36, unchanged |

## Findings

- smell(js:generate-endpoints): every `generate-endpoints` + prettier run moves the `// @hand-written` import in `src/hub/code.ts` below a blank line (import-order churn); reverted both times, not committed — open
    where: /Users/djovaisas/Projects/norbix/worktrees/norbix-js/feat/keyless-templates/src/hub/code.ts:4
- smell(dart:format): `dart format` with the installed SDK reflows whole files (new tall style); the hand-written edits were made without it to keep the diff small — open
- smell(mcp,react-redux:format): `prettier --check` on MCP `src/server.ts` / `tests/tools.test.ts` / `README.md` reports issues that were already there on main (no prettier script in MCP); react-redux `eslint .` flags `examples/basic` (not in `npm run lint`) — open, pre-existing
- docs(runbook:routine-c): as in the earlier rounds, the emitters were run on the two Surface test projects with `NORBIX_SDK_COVERAGE_DIR`; `check_route_drift.py` looks for the gateway at `$NORBIX_SDK_ROOT/../gateway`, so the link folder needs a sibling `gateway` link — open (worth a line in HOW_TO_UPDATE.md)
- note(typegen:manifest): `KeylessIntegrationSetupTemplate` fields are required (`kind`, `fileName`, `content`) in TS / MCP and non-null in Dart; Kotlin makes them nullable as always — expected

## Rejected / moved out

- Pull requests and releases — the orchestrator ships after the gateway.
- Raising `@norbix.ai/ts` in react-redux and norbix-mcp — waits for the js release.

### Release order (later)

1. gateway `feat/keyless-templates` merged and deployed; typegen merged (no release).
2. sdk-ts (`feat(types)` → minor), sdk-net and sdk-go (`feat(types)` → minor).
3. sdk-python, sdk-dart, sdk-kotlin, sdk-swift: `docs(hub)` / `chore(types)` commits only — no release is
   cut, and none is needed (the maps already carry `templates`); they ship with their next release.
4. react-redux: raise `@norbix.ai/ts` to the new sdk-ts version (typed `templates`), release (the `docs(hooks)` commit alone releases nothing).
5. norbix-mcp: `NORBIX_JS_DIR=<checkout of the released sdk-ts tag> npm run generate-manifest` (should match ffebcce), raise `@norbix.ai/ts`, `npm test`, release.
6. cli: `feat(integrations)` → minor; can release any time after the gateway (no SDK bump needed).

## Needs you

Nothing.

## Open questions

None blocking.
