# Keyless cloud connections — SDKs, CLI and MCP

## Goal

Bring every Norbix SDK, the CLI and the MCP server up to the gateway's
"keyless cloud connections" contract (Azure + AWS, gateway branch
`feat/keyless-cloud` at 96fcb99d4): new save-request fields, the removed
cross-account role, and the new `GET /{version}/integrations/keyless/setup`.

Not in scope: opening or merging pull requests, releases, the dependency bumps
that wait for the `@norbix.ai/ts` release, Logging's AWS cross-account role
(the gateway keeps it).

## Plan

1. Routine C from the gateway worktree: both endpoint manifests into a typegen
   worktree, the raw contract, `build_matrix.py`, `check_route_drift.py`;
   commit in typegen — **done**
2. Regenerate the types: norbix-js, norbix-net, norbix-go, the norbix-dart and
   norbix-kotlin references; python / swift have nothing to regenerate (no
   `references/` folder in either) — **done**
3. Routine D for the setup endpoint in all 8 SDKs (the coverage matrix shows
   every SDK has the files / email / code integration methods, so every SDK
   gets it), in a new `integrations` module (where `endpoints.hub.json` puts
   it) — **done**
4. CLI `norbix integrations keyless-setup <module> <cloud> [--integration-id]`
   — **done** (builds only against a local norbix-js build until the release)
5. MCP manifest from the js worktree, plus a curated tool — **done**
   (dependency not raised)
6. Full test / lint commands per repo — **done**, all green (numbers below)
7. Final `build_matrix.py` against the finished worktrees; this report — **done**
8. Follow-up for gateway d6b2eaf90 (`AuthMode` → `CloudAuthMode?`, `AcceptKeyRisk` → `bool?`
   on the six save requests, omitted = Keyless): Routine C + contract, types in
   js / net / go / dart / kotlin, .NET test and README simplified, MCP manifest,
   react-redux and cli re-run against the new local js build — **done**

## Changes

Every branch is `feat/keyless-cloud`, made from `origin/main` with
`sdks/scripts/worktree/new.sh`, pushed, no pull request.

| Repo · worktree | Commits | What changed | Step |
|---|---|---|---|
| typegen · /Users/djovaisas/Projects/norbix/worktrees/typegen/feat/keyless-cloud | eb1e7d0, 6bedb35, f16e0fd (raw Hub contract for d6b2eaf90; manifests unchanged) | `core/contract.raw.{api,hub}.json`, `coverage/endpoints.hub.json` (+ GetKeylessIntegrationSetup, module `integrations`), matrix; second commit: the keyless row `yes` for all 8 SDKs | 1, 7 |
| norbix-js · /Users/djovaisas/Projects/norbix/worktrees/norbix-js/feat/keyless-cloud | a188bc8 (Breaking), 8ede0d9, 2c11a2a, 6056597 (optional authMode / acceptKeyRisk) | types regenerated; generated quick-connect payments methods that were missing (see Findings); new generated `hub.integrations` module with `getKeylessIntegrationSetup`, doc page `docs/hub/integrations.md`, hand-written `tests/keyless-setup.test.ts` | 2, 3 |
| norbix-net · /Users/djovaisas/Projects/norbix/worktrees/norbix-net/feat/keyless-cloud | 702ef03 (Breaking), 0a4f966, 7013c1b (nullable AuthMode / AcceptKeyRisk; test no longer sets AuthMode; README keyless example without AuthMode, key-mode example with AccessKey + AcceptKeyRisk) | `Generated/{Api,Hub}.dtos.cs`; `GetKeylessIntegrationSetupAsync` comes from the source generator; snapshots (echo ×2, integrations, files save); `HubKeylessSetupTests.cs`; README row + "Keyless cloud connections" section | 2, 3 |
| norbix-go · /Users/djovaisas/Projects/norbix/worktrees/norbix-go/feat/keyless-cloud | a109fb0 (Breaking), 484d469, ba5ebda (AcceptKeyRisk `*bool`, omitempty) | `norbix/{api,hub}/dtos/dtos.go`; `norbix/hub/integrations.go` + namespace; `integrations_keyless_test.go`; README section | 2, 3 |
| norbix-python · /Users/djovaisas/Projects/norbix/worktrees/norbix-python/feat/keyless-cloud | 418075c | `hub/integrations.py` (sync + async), namespace, `tests/hub/test_integrations_keyless.py`, `docs/hub/integrations.md` + index row | 3 |
| norbix-dart · /Users/djovaisas/Projects/norbix/worktrees/norbix-dart/feat/keyless-cloud | 43e46e5, e3ee8c0, 0fe2b2b (descriptions only; already nullable) | `references/*.dtos.dart` (x dart update mode); `lib/src/hub/resources/integrations.dart` + client; test; README | 2, 3 |
| norbix-kotlin · /Users/djovaisas/Projects/norbix/worktrees/norbix-kotlin/feat/keyless-cloud | c86b035, ef510fc, 070431f (descriptions only; already nullable) | `references/*.dtos.kt` (x kotlin update mode); `IntegrationsModule.kt` + NorbixHub; test; README | 2, 3 |
| norbix-swift · /Users/djovaisas/Projects/norbix/worktrees/norbix-swift/feat/keyless-cloud | 3848d32 | `IntegrationsModule.swift` + client (not the protocol, see Findings); test; README | 3 |
| norbix-react-redux · /Users/djovaisas/Projects/norbix/worktrees/norbix-react-redux/feat/keyless-cloud | 0ebb8d7 | `src/hooks/hub/integrations.ts` (`useGetKeylessIntegrationSetupQuery`, no cache tags), wired in `buildEndpoints`; test; README | 3 |
| cli · /Users/djovaisas/Projects/norbix/worktrees/cli/feat/keyless-cloud | a427c18 + this report | `src/commands/integrations/keyless-setup.ts`, `tests/integrations-keyless-setup.test.ts`, schema snapshot, README row, COVERAGE.md | 4, 7 |
| norbix-mcp · /Users/djovaisas/Projects/norbix/worktrees/norbix-mcp/feat/keyless-cloud | 5d6f341, b94a848, e5b7d9a (manifest: authMode / acceptKeyRisk optional; tool description says leave authMode out) | `src/manifest/*` from the js worktree; curated `norbix_get_keyless_integration_setup`; tests; README | 5 |

How the types were pointed at the private gateway (Hub `http://127.0.0.1:52642`,
Api `http://127.0.0.1:52641`): Go and C# with `--hub-url` / `--api-url`;
norbix-js, Dart and Kotlin read `BaseUrl:` from each file's own header, so the
header was switched to the private address for the run and switched back to
`localhost:5001` / `5002` before the commit (no changed default is committed).
norbix-js used the maintained `typegen/languages/typescript/reference/*.mjs`
copied into its gitignored `scripts/`, as that README says.

### Test results (step 6)

| Repo | Command | Result |
|---|---|---|
| norbix-js | `vitest run` · `npm run lint` · `prettier --check .` · `tsc --noEmit` · `typecheck:dist` | 72 files, 1148 passed · clean · clean · clean · clean (no examples folder) |
| norbix-net | `dotnet test Norbix.Sdk.sln` (no audit switch needed) | Sdk.Tests 111, Hub.Tests 279, Coexistence 2 — all passed |
| norbix-go | `go build ./...` · `go vet ./norbix/...` · `gofmt -l .` · `go test ./...` | clean · clean · clean · 204 top-level tests passed, 0 failed |
| norbix-python | `uv run pytest` · `make lint` · `make typecheck` | 1235 passed · clean · clean |
| norbix-dart | `dart analyze` · `dart test` | no issues · 511 passed |
| norbix-kotlin | `./gradlew test` | 331 passed |
| norbix-swift | `swift test` | 143 passed |
| norbix-react-redux | `vitest run` · `tsc --noEmit` · `eslint` (against a local norbix-js build) | 503 passed, 2 skipped · clean · clean; `prettier --check .` lists 19 files that were already unformatted on main (none touched here) |
| cli | `npm test` · `tsc --noEmit` (against a local norbix-js build) | 48 files, 1212 passed · clean |
| norbix-mcp | `npm test` · `tsc --noEmit` · `npm run build` | 97 passed · clean · clean |

After the d6b2eaf90 follow-up (step 8), re-run: js 72 files / 1148 passed, tsc / lint / prettier clean; .NET 111 + 279 + 2 passed; Go build / vet / gofmt clean, 204 passed; Dart 511 passed; Kotlin `gradlew test` green; react-redux 503 passed, 2 skipped, tsc clean; cli 48 files / 1212 passed, tsc clean; MCP 97 passed, tsc clean (react-redux and cli against the new local js build).
| typegen | `check_route_drift.py` (source scan / `--contract`) | 89 / 36 before and after — unchanged |

The local norbix-js build: `npm run build && npm pack` in the js worktree, the
tarball unpacked over `node_modules/@norbix.ai/ts` in the react-redux and cli
worktrees. `package.json` / `package-lock.json` were never changed.

## Findings

- bug(gateway:integrations): `CloudAuthMode` has `AccessKey = 0`, and the Keyless default lived only in a property initializer that generated SDK types cannot carry, so a .NET caller who left `AuthMode` unset sent `accessKey` and was refused (CM-ERRORS-INTEGRATIONS-034); TypeScript and the MCP schema marked `authMode` / `acceptKeyRisk` as required — **fixed by gateway d6b2eaf90**: `AuthMode` is `CloudAuthMode?` and `AcceptKeyRisk` is `bool?` on the six save requests (omitted = Keyless; the domain enum stays `AccessKey = 0`). Regenerated everywhere (step 8); the .NET test and README no longer set `AuthMode` for keyless — done
    where: /Users/djovaisas/Projects/norbix/worktrees/gateway/feat/keyless-cloud (branch feat/keyless-cloud, commit d6b2eaf90)
- smell(net:files): the same enum-default problem already exists for `Provider`: the .NET S3 save test sends `"provider": "local"` for an `AwsS3FilesIntegrationRequest` (the gateway picks the subtype by its own rules, so it works) — open, pre-existing
- drift(js:payments): the quick-connect types were regenerated on main (ba99ff4) but `generate-endpoints` was not run, so `startPaymentsIntegrationConnect`, `completePaymentsIntegrationConnect`, `disconnectPaymentsIntegrationConnect`, `getQuickConnectProviders` and `getIntegrationConnectTargets` were missing from norbix-js. They are served by gateway refactoringV2; added by the generator in their own commit 8ede0d9 (payments) and in 2c11a2a (the two integrations ones share the new module) — fixed here
- gap(sdks:integrations): Python, Go, Dart, Kotlin, Swift and React-Redux still lack the two quick-connect `integrations` routes (`/integrations/connect/providers`, `/integrations/connect/{ConnectId}/targets`) — `no` cells in `coverage/modules/integrations.md`; left open (not keyless)
- decision(js:types): the regeneration also made workflow `executionIdentityId` optional — a gateway base change, not breaking — done
- smell(go,dart:modules): module files say `Code generated by gen_modules.py` (Go) and `Regenerate with: dart run tool/generate_resources.dart` (Dart); neither generator exists in any checkout. The new files are hand-written in the same shape and say so (Dart) or carry no false header (Go) — open
- gap(go:references): `norbix-go/references/hub.dtos.go` still has 12 `CrossAccountRole` mentions; it is `//go:build ignore`, last regenerated 2026-10-07, and the runbook gives no command for it — left as is
- decision(swift:client): `integrations` is on `NorbixHubClient` but not on the `NorbixHubClientType` protocol: adding a protocol requirement breaks apps that implement it (`environments` and `regions` are not in it either) — done
- docs(runbook:routine-c): `dotnet test src/Api.sln --filter "FullyQualifiedName~Emit_Api_Endpoint_Manifest"` ran no test from the gateway worktree ("No test matches" in the Hub test assemblies); running it on `tests/Isidos.CodeMash.Tests.Services.Api.Surface/…csproj` works. The Api manifest did not change (no new Api route) — open
- docs(coverage): `build_matrix.py` / `check_route_drift.py` scan the main checkouts by default, and several (python, dart, kotlin, swift, cli, typegen) are on other branches. I ran both with `NORBIX_SDK_ROOT` = a folder of symlinks to the `feat/keyless-cloud` worktrees — open (worth a note in HOW_TO_UPDATE.md)
- decision(go:types): `AcceptKeyRisk` went from `bool` to `*bool` in Go between the two runs on this unreleased branch; no released caller is affected — done
- tooling(npm): `npm install --no-save <tarball>` pruned 20 packages (vite among them) in react-redux; unpacking the tarball over `node_modules/@norbix.ai/ts` works and leaves the package files alone — noted
- docs(runbook): the runbook's commit trailer still names "Claude Fable 5.1"; this run used the line the orchestrator gave — open
- design(gateway:contract): Logging keeps `AwsS3CrossAccountRoleLoggingIntegrationDto` (gateway decision) — it still appears in the types, as expected

## Rejected / moved out

- Pull requests and releases — the orchestrator ships gateway, SDKs, CLI and MCP together.
- Raising `@norbix.ai/ts` in cli, norbix-mcp and norbix-react-redux — waits for the js release (order below).
- CLI `npm run gen:fields` (rebuilds `src/generated/request-fields.json` from the installed SDK) — part of the CLI's dependency bump.
- Quick-connect routes in the other six SDKs — not keyless; Finding above.

### Release order (later)

1. gateway `feat/keyless-cloud` merged and deployed; typegen `feat/keyless-cloud` merged (no release).
2. SDKs, any order: sdk-ts (norbix-js, breaking types → minor), sdk-net (breaking → minor), sdk-go (breaking → minor), sdk-python, sdk-dart, sdk-kotlin, sdk-swift.
3. react-redux: raise the `@norbix.ai/ts` peer / dev range to the new sdk-ts version, release.
4. norbix-mcp: `NORBIX_JS_DIR=<checkout of the released sdk-ts tag> npm run generate-manifest` (should be byte-identical to 5d6f341), raise `@norbix.ai/ts`, `npm test`, release.
5. cli: raise `@norbix.ai/ts`, `npm run gen:fields`, `npm test`, release (the CLI does not compile against 4.39.0: `hub.integrations` is missing).

## Needs you

- [ ] Accept the breaking type change in sdk-ts, sdk-net and sdk-go (`Breaking:` line in each types commit): the three AWS CrossAccountRole DTOs, the `Aws*IntegrationType` enums and the `integrationType` / `externalId` fields are gone. No SDK method or example used them.

## Open questions

None blocking.
