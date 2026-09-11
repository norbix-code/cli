# 10b Files — SLICE SDK (4 SDKs + the CLI)

## Goal
For every non-trigger Files endpoint, make sure each SDK (.NET, Go, TypeScript,
Python) and the command-line tool (CLI) has **a method, a test that runs green,
and a documentation page** — and fix what is missing.

Not in scope:
- File **triggers** (6 endpoints) — another agent owns them.
- Dart, Kotlin, Swift, React-Redux SDKs — report only, no fixes.
- The documentation repository (`docs/codemash-docs`) — SLICE DOC owns it. I only
  read it and report what I found.
- Regenerating shared types (`typegen` output).

## Scope — the endpoints (read from the gateway code, 2026-09-11)

Source: `gateway/src/**` route attributes (`grep '"/{version}/files'`).
**20 non-trigger endpoints**: 12 on the Hub (the dashboard API) and 8 on the
public API.

Hub (12): EnableFiles · DisableFiles · GetFolderFiles · GetFile ·
GetFilesIntegrations · SaveFilesIntegration · TestFilesIntegration ·
GetFilesIntegration · DeleteFilesIntegration · EnableFilesIntegration ·
DisableFilesIntegration · SetFilesIntegrationAsDefault

Public API (8): ListFiles · GetFileInfo · GetSignedUrl · RequestUploadUrl ·
CommitUpload · Download · DeleteFile · DeleteManyFiles

Correction to the slice packet: it says "21 (13 Hub + 8 API)". The code has
**12 Hub + 8 API = 20**.

Excluded on purpose: `GET/PUT /{version}/files/{id}/content` (added by slice V2).
These two are the target of a signed link, like a pre-signed Amazon S3 link. The
caller gets the whole address back from `GetSignedUrl` / `RequestUploadUrl` and
then fetches it with a plain HTTP call, so a typed SDK method would add nothing.

## STATUS TABLE — endpoint × language

`M` method exists · `T` test exists and passes · `D` documented in that
repository. `—` means missing.

| Endpoint | .NET | Go | TS | Py | CLI |
|---|---|---|---|---|---|
| `EnableFiles` | M T | M T | M T D | M T D | ➖ |
| `DisableFiles` | M T | M T | M T D | M T D | ➖ |
| `GetFolderFiles` | M T | M T | M T D | M T D | ➖ |
| `GetFile` | M T | M T | M T D | M T D | ➖ |
| `GetFilesIntegrations` | M T | M T | M T D | M T D | ➖ |
| `SaveFilesIntegration` | M T | M T | M T D | M T D | ➖ |
| `TestFilesIntegration` | M T | M T | M T D | M T D | ➖ |
| `GetFilesIntegration` | M T | M T | M T D | M T D | ➖ |
| `DeleteFilesIntegration` | M T | M T | M T D | M T D | ➖ |
| `EnableFilesIntegration` | M T | M T | M T D | M T D | ➖ |
| `DisableFilesIntegration` | M T | M T | M T D | M T D | ➖ |
| `SetFilesIntegrationAsDefault` | M T | M T | M T D | M T D | ➖ |
| `ListFiles` | M T | M T | M T D | M T D | M T D |
| `GetFileInfo` | M T | M T | M T D | M T D | M T D |
| `GetSignedUrl` | M T | M T | M T D | M T D | M T D |
| `RequestUploadUrl` | M T | M T | M T D | M T D | M T D |
| `CommitUpload` | M T | M T | M T D | M T D | M T D |
| `DownloadFileApi` | M T | M T | M T D | M T D | M T D |
| `DeleteFileApi` | M T | M T | M T D | M T D | M T D |
| `DeleteManyFilesApi` | M T | M T | M T D | M T D | — |

`➖` = the CLI has no command for the hub endpoints. `—` on bulk delete = the CLI
has no bulk-delete command. Both are product gaps, not test gaps.

**Method + test: 20 / 20 in all four SDKs.** Documentation lives per repository:
TypeScript and Python have per-module pages; .NET and Go have no per-module
documentation folder at all (see "Needs you").

### Where the evidence is

| What | File | Result |
|---|---|---|
| .NET public API, 8 tests | `norbix-net/tests/Norbix.Sdk.Tests/FilesEndpointTests.cs` | 8 passed |
| .NET generated coverage snapshot | `norbix-net/tests/Norbix.Sdk.Tests/test_results/EndpointCoverageTests.Api.Files.verified.txt` | 1 passed |
| .NET hub, 12 tests | `norbix-net/tests/Norbix.Hub.Tests/HubFilesEndpointTests.cs` | 12 passed |
| Go, 20 tests | `norbix-go/norbix/files_test.go` | 20 passed (`go test ./norbix/...`) |
| TypeScript, 28 tests (includes triggers) | `norbix-js/tests/{hub,api}/files.test.ts` | 28 passed, already complete before this slice |
| Python, 20 route tests | `norbix-python/tests/test_files_routes.py` | 20 passed; whole suite 524 passed |
| Python generated tests | `norbix-python/tests/{hub,api}/test_files.py` | 28 passed |
| CLI, 8 tests | `cli/test/files.test.ts` | 8 passed |

Command used per repository:
`dotnet test -p:NuGetAudit=false --filter "FullyQualifiedName~Files"` ·
`go test ./norbix/...` · `npx vitest run tests/{hub,api}/files.test.ts` ·
`uv run pytest` · `npm test`.

## What was actually wrong (findings)

**F1 — .NET could not download a file at all.** `HttpTransport` always parsed
the response body as JSON. `DownloadFileApiAsync` returns `byte[]`, and a
download streams the file itself, so every call threw *"Failed to deserialize
response from Norbix gateway"*. This also crashed the generated coverage run,
which is why `EndpointCoverageTests.Api.Files` had no snapshot at all. Fixed:
when the response type is `byte[]`, read the raw bytes.
Proof: `FilesEndpointTests.Download_returns_the_raw_bytes` checks the bytes come
back unchanged (`RoundTripped: true`).

**F2 — .NET hub Files endpoints had no test at all, and a stale snapshot hid
it.** `Norbix.Sdk.Tests` references the API package only, because `Norbix.Api`
and `Norbix.Hub` share the same runtime sources and both declare
`Norbix.Sdk.NorbixClient`, so one project cannot reference both. Its
`EndpointCoverageDriver` throws on any Hub endpoint. The
`EndpointCoverageTests.Hub.*.verified.txt` files in that project are leftovers
from an older layout — **no test runs them today**, and `Hub.Files` in
particular lists 15 endpoints and is missing `GetFolderFiles`, `GetFile` and
`TestFilesIntegration`. A reader would take that file as evidence of coverage
that does not exist. Fixed for Files by adding a second test project,
`tests/Norbix.Hub.Tests`. The stale snapshots for the other 12 hub modules are
left alone — outside this slice, see "Needs you".

**F3 — the Go SDK had no Files test whatsoever.** Added 20.

**F4 — `TestFilesIntegration` was missing from Go and Python.** The shared
contract (`sdks/typegen/core/contract.json`) already has it, so both generated
module files had simply fallen behind. Added by hand in the exact shape the
generator produces. The real fix is a regeneration run — see "Needs you".
The slice packet's "known gap: TestFilesIntegration is in NO SDK" was out of
date: TypeScript and .NET already had it.

**F5 — the Python Files tests could not catch a wrong route.** The generated
`tests/hub/test_files.py` and `tests/api/test_files.py` only check the HTTP verb
and that the address starts with `https://`. A method pointed at the wrong path
would pass. Added `tests/test_files_routes.py`, which checks the path itself and
the values sent.

**F6 — Python documentation was missing and stale.** `docs/api/files.md` did not
exist. `docs/hub/files.md` was missing `get_folder_files`, `get_file` and
`test_files_integration`. Both written, with the counts in the two index pages.

**F7 — the CLI repository had no test setup at all**: no `test` script, no test
folder, no test dependency, and the CI workflow ran only `--help`. Added vitest
plus `@oclif/test`, 8 tests for the six `files` commands, and `npm test` in CI.
The tests point `HOME` at an empty temporary folder so they never read the
developer's own `~/.norbix` settings or a live login session.

**F8 — the 2026-09-04 SDK coverage matrix had drifted badly.** It claimed
`TestFilesIntegration` was in no SDK (TypeScript had it) and React-Redux 0/26
(it has 19 of 20). It was generated by searching for route strings.
`sdks/tests/coverage/modules/files.md` is rewritten from what I actually opened.

**F9 — pre-existing red in `norbix-net`, not caused by this slice and not fixed
here.** On a clean checkout of `origin/main`:
- `dotnet test` refuses to restore: `NU1902` (a known vulnerability in
  `Microsoft.Build.Tasks.Git` 8.0.0, pulled in by SourceLink) is treated as an
  error. Every run in this slice used `-p:NuGetAudit=false` to get past it.
- Five generated coverage snapshots are stale after the DTO regeneration and
  fail: `Api.Chat`, `Api.Database`, `Api.Echo`, `Api.Membership`, `Api.Public`.
  Verify re-blessed some of them during my runs; I reverted every one so this
  branch changes only the Files snapshot.

**F10 — documentation-repository gaps (reported, not fixed — SLICE DOC owns that
repository).**
- `sdk/reference/files/` has a page for 19 of the 20 endpoints.
  `test-files-integration` (`POST /files/integrations/test`) has no page.
- `cli/norbix-cli.md` (56 lines) does not mention the `norbix files` commands at
  all — the whole `files` topic is undocumented there.

**F11 — secondary SDKs (report only).** Non-trigger Hub out of 12 / public API
out of 8: Dart 11/8 · Kotlin 11/8 (has tests) · Swift 9/8 (missing
`GetFolderFiles`, `GetFile`, `TestFilesIntegration`; its hub test file has one
case) · React-Redux 11/8 (hooks only, no tests). All four are missing
`TestFilesIntegration`.

## Plan
1. [done] Survey — endpoint list from gateway code; one worktree per SDK
   repository; record what exists today.
2. [done] .NET — fixed binary download handling (F1), added 8 public-API tests
   and the missing coverage snapshot, added `tests/Norbix.Hub.Tests` with 12 hub
   tests (F2).
3. [done] Go — added `TestFilesIntegration` and 20 tests (F3, F4).
4. [done] TypeScript — checked; already complete (20/20 method, test and
   documentation). No change needed, worktree removed.
5. [done] Python — added `test_files_integration` sync and async (F4), added 20
   route tests (F5), wrote the missing API documentation page and fixed the hub
   page (F6).
6. [done] CLI — added the test setup, 8 tests, CI step and README section (F7).
7. [done] Read the SDK reference pages in the documentation repository; gaps
   reported for SLICE DOC (F10). No edits there.
8. [done] Rewrote `sdks/tests/coverage/modules/files.md` (F8) and finished this
   report.

## Changes

| file | what changed | step |
|------|--------------|------|
| `norbix-net/src/Norbix.Sdk/Transport/HttpTransport.cs` | read raw bytes when the response type is `byte[]` | 2 |
| `norbix-net/src/Norbix.Sdk/AssemblyInfo.cs` | `InternalsVisibleTo` for the new Hub test project | 2 |
| `norbix-net/tests/Norbix.Sdk.Tests/FilesEndpointTests.cs` | new — 8 public-API tests | 2 |
| `norbix-net/tests/Norbix.Sdk.Tests/Helpers/{MockHttpHandler,NorbixTestFixture}.cs` | can answer with raw bytes, for download | 2 |
| `norbix-net/tests/Norbix.Sdk.Tests/EndpointCoverageDriver.cs` | print a byte-array response as its length, not the bytes | 2 |
| `norbix-net/tests/Norbix.Sdk.Tests/test_results/EndpointCoverageTests.Api.Files.verified.txt` | new — the snapshot that could not be produced before | 2 |
| `norbix-net/tests/Norbix.Sdk.Tests/test_results/FilesEndpointTests.*.verified.txt` | new — 8 snapshots | 2 |
| `norbix-net/tests/Norbix.Hub.Tests/**` | new test project — 12 hub tests + snapshots | 2 |
| `norbix-net/Norbix.Sdk.sln` | the new test project added | 2 |
| `norbix-go/norbix/hub/files.go` | added `TestFilesIntegration` | 3 |
| `norbix-go/norbix/files_test.go` | new — 20 tests | 3 |
| `norbix-python/src/norbix_python/hub/files.py` | added `test_files_integration`, sync and async | 5 |
| `norbix-python/tests/test_files_routes.py` | new — 20 route tests | 5 |
| `norbix-python/tests/hub/test_files.py` | added the test-integration case to the surface and shape tests | 5 |
| `norbix-python/docs/api/files.md` | new page | 5 |
| `norbix-python/docs/hub/files.md` | added the three missing methods + a short explanation | 5 |
| `norbix-python/docs/{api,hub}/_index.md` | module counts corrected | 5 |
| `cli/package.json` | `test`, `test:watch`, `pretest` scripts; vitest + `@oclif/test` | 6 |
| `cli/vitest.config.ts`, `cli/test/setup.ts` | new — test setup, sandboxed `HOME` | 6 |
| `cli/test/files.test.ts` | new — 8 tests for the six commands | 6 |
| `cli/github-workflows/ci.yml` | `npm test` added to CI | 6 |
| `cli/README.md` | the six commands documented + how to run the tests | 6 |
| `sdks/tests/coverage/modules/files.md` | rewritten from verified facts | 8 |
| `cli/docs/tasks/10b-files-SDK.md` | this report | 1, 8 |

## Rejected / moved out
- **Documentation repository edits** (`docs/codemash-docs`): the missing
  `test-files-integration` SDK reference page, and the `norbix files` commands
  missing from `cli/norbix-cli.md`. SLICE DOC owns that repository and two
  slices must not edit one repository in parallel. Details in F10. → SLICE DOC /
  DOC-2.
- **Regenerating the Go and Python modules from `sdks/typegen`**: out of scope
  for this campaign ("do not regenerate types"). The one missing method was
  added by hand in the generator's own shape instead. → new ticket needed.
- **The stale `EndpointCoverageTests.Hub.*.verified.txt` files for the other 12
  .NET hub modules**, and the five failing `Api.*` snapshots: outside Files.
  Every snapshot Verify re-blessed during my runs was reverted, so this branch
  touches only the Files snapshot. → see F2 and F9.
- **Dart, Kotlin, Swift, React-Redux**: report only, per the packet. See F11.
- **Uncommitted work in the main checkouts** (`norbix-js` documentation edits,
  `cli` `src/commands/hub.ts` and others): not mine, untouched. All work was
  done in worktrees branched from `origin/main`.
- **A `TestFilesIntegration` command for the CLI**, and CLI commands for bulk
  delete / hub browsing / integration management: product gaps, not test gaps.
  Not added.

## Needs you
- [ ] **Approve and merge four pull requests** (protected `main`):
  `norbix-net`, `norbix-go`, `norbix-python`, `cli` — all on branch
  `test/files/SDK`. `norbix-js` needed no change; its worktree and branch are
  already removed.
- [ ] **`git push` could not reach GitHub from this session** (SSH to
  github.com timed out). The branches are committed locally in their worktrees
  and rebased onto `origin/main`; the push and the pull requests are the main
  chat's step.
- [ ] **Decide on the NuGet audit error in `norbix-net`** (F9). `dotnet test`
  fails to restore on a clean `origin/main` because `NU1902` is an error. Either
  bump SourceLink so `Microsoft.Build.Tasks.Git` 8.0.0 goes away, or set
  `NuGetAuditMode`. Until then every run needs `-p:NuGetAudit=false`.
- [ ] **Decide who re-blesses the five stale .NET coverage snapshots** (F9):
  `Api.Chat`, `Api.Database`, `Api.Echo`, `Api.Membership`, `Api.Public`. They
  have been red since the DTO regeneration and are not Files.
- [ ] **Schedule a `typegen` regeneration run** for Go and Python (F4), then
  check the hand-added `TestFilesIntegration` matches what the generator writes.
- [ ] **Decide whether .NET and Go should have per-module documentation pages.**
  TypeScript and Python both have `docs/{api,hub}/files.md`; `norbix-net` has
  only `docs/integrations/` and `norbix-go` has no `docs/` folder at all. This
  is a whole-repository decision, not a Files one.
- [ ] **Pass F10 to SLICE DOC**: the missing `test-files-integration` reference
  page and the `norbix files` commands missing from `cli/norbix-cli.md`.

## Open questions
- The slice packet says "13 Hub endpoints"; the code declares 12. Which one is
  the thirteenth? I worked with the 12 the code declares.
- Confirm the two content endpoints (`GET/PUT /files/{id}/content`) stay out of
  the SDKs, as argued under "Scope".
- Should the secondary SDKs (Dart, Kotlin, Swift, React-Redux) also get
  `TestFilesIntegration`? All four are missing it. Not done — report only.
