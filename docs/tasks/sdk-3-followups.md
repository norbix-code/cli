# SLICE SDK-3 — the follow-ups left behind by the SDK-2 merge

Seven items from `gateway/docs/tasks/sdk-management.md`: #42, #44, #41, #43,
#60, #61, and Routine A for everything touched. Nothing merged by me — three
pull requests are open and waiting, plus this report.

## Goal

SDK-2 shipped, but it left a trail: the .NET build could not even restore, the
.NET Hub coverage snapshots were decoration rather than tests, the TypeScript
DTO file did not parse, and the Go reference DTOs did not parse either. This
slice clears that trail, without adding a single endpoint to any SDK.

**Not in scope:** any new endpoint · the secondary SDKs (Dart, Kotlin, Swift,
React-Redux — that is SLICE SDK-4) · the gateway, which I only read from and
ran two manifest emitters in.

## Status at a glance

| # | What | Result |
|---|---|---|
| 42 | .NET: the vulnerable NuGet package | **done** — audit stays on, restore green |
| 44 | .NET: the 5 red `Api.*` snapshots | **done** — already green; every route re-checked against the manifest |
| 41 | .NET: hub coverage tests in the right project | **done** — 21 modules, 489 endpoints, real snapshots |
| 43 | Go + Python: run the generator, commit the diff | **blocked** — the generator does not exist yet. See "Needs you". |
| 60 | typegen TypeScript: the `@sdk-dto-patches` block | **done** — generator fixed, `hub2.dtos.ts` regenerated, 4 tests added |
| 61 | typegen Go: the C# generics | **done** — generator-side fixer added, `gofmt -l .` clean |
| — | Routine A | **done** — 3 pull requests + this one |

## The pull requests

Merge order does not matter here: no repository depends on another in this
slice, and the CLI is untouched apart from this file.

| repo | branch | branched from | pull request | tests after |
|---|---|---|---|---|
| norbix-net | `chore/sdk-followups` | `origin/main` | https://github.com/norbix-code/sdk-net/pull/49 | 142 passed, 0 failed |
| norbix-go | `chore/sdk-followups` | `origin/main` | https://github.com/norbix-code/sdk-go/pull/3 | all packages ok |
| norbix-js | `chore/sdk-followups` | `origin/main` | https://github.com/norbix-code/sdk-ts/pull/38 | 706 passed (40 files) |
| cli | `chore/sdk-followups` | `origin/main` | _(this report — link added on open)_ | untouched |
| norbix-python | — | — | **no pull request, nothing changed** | 595 passed |
| typegen | `main` | — | **committed directly**, not pushed — see "Needs you" | `node --test` 4 passed |

Every branch was rebased on `origin/main` before the push. Nothing had moved
since I branched, so no rebase was actually applied and the green runs above
are the runs on the pushed commits.

## Changes

### #42 — the NuGet audit (norbix-net)

`dotnet restore` failed on a clean `origin/main`:

```
error NU1902: Warning As Error: Package 'Microsoft.Build.Tasks.Git' 8.0.0
has a known moderate severity vulnerability
```

`dotnet list package --vulnerable --include-transitive` reported exactly one
package, in four projects: `Microsoft.Build.Tasks.Git` 8.0.0, pulled in
transitively by `Microsoft.SourceLink.GitHub` 8.0.0
([GHSA-23fw-v26w-5fgq](https://github.com/advisories/GHSA-23fw-v26w-5fgq)).

`Directory.Packages.props` now pins `Microsoft.SourceLink.GitHub` **10.0.401**,
the current release for the `net10.0` target, which brings
`Microsoft.Build.Tasks.Git` 10.0.401. That is the whole change — one line.

`dotnet test Norbix.Sdk.sln` restores and runs **with the audit switched on**.
No `-p:NuGetAudit=false` anywhere. Per the decision, the audit was not touched.

### #41 + #44 — the coverage snapshots (norbix-net)

The 13 `EndpointCoverageTests.Hub.*.verified.txt` files lived in
`Norbix.Sdk.Tests`. That project references `Norbix.Sdk`, whose generated
`NorbixEndpointCatalog` contains only the **Api** surface, so
`EndpointCoverageTests` produced 6 Api test cases and never a Hub one. The 13
Hub files were written once by hand and then never touched by anything: they
claimed coverage that did not exist.

`Norbix.Hub.Tests` already shared the fixture and `EndpointCoverageDriver.cs`
by `<Compile Include>`. It now also shares `EndpointCoverageTests.cs`. Because
the driver reads whichever catalogue is compiled into the assembly under test,
that one file yields the 6 Api modules in `Norbix.Sdk.Tests` and the 21 Hub
modules in `Norbix.Hub.Tests` — no duplicated test code.

Two defects in the shared driver had to be fixed first, or the new snapshots
would have been as hollow as the old ones:

1. **One broken endpoint blanked out its whole module.** If any endpoint in a
   group had a route token with no settable property, `CoverModuleAsync`
   returned *only* the `MissingPathParameters` list and never invoked anything.
   Notifications has 117 endpoints and 4 such tokens, so it produced no
   coverage at all. The broken endpoints are still reported — now inside the
   module's own snapshot, where a reviewer sees them next to what does work —
   and the other 113 endpoints are exercised.
2. **The Account module died on deserialization.** `POST /{version}/account/mcp`
   returns a bare JSON-RPC string, not a response envelope, and the fake
   response builder always produced an object. The whole module threw before
   writing anything.

Result: **21 Hub modules, 489 endpoints** covered, alongside the 6 Api modules
and 77 endpoints. `dotnet test Norbix.Sdk.sln` — **142 passed, 0 failed**, up
from 121.

For #44 specifically: the 5 snapshots reported red were **already green** on
current `origin/main` — the SDK-2 merge fixed them, and there was no received
file to accept. That did not let me skip the check the packet asks for, so I
ran Routine C first and then compared every route in every accepted snapshot
against the freshly emitted manifests:

| | routes in snapshots | confirmed by the manifest | not in the manifest |
|---|---|---|---|
| Hub | 489 | 472 | 17 |
| Api | 77 | 59 | 18 |

**All 35 unconfirmed routes were then confirmed by hand** against `[Route]`
attributes in the gateway source — every one exists. Not one is a phantom the
SDK invented, so accepting the snapshots is safe. The gap is in the manifest
emitter, and it has two causes (both gateway-side, see "Needs you").

### #60 — the `@sdk-dto-patches` block (typegen + norbix-js)

`applySdkDtoPatches` ended with:

```js
return src.replace(/\n}\s*$/, `${block}\n}`);
```

That is correct for the portal's files. They set `GlobalNamespace:` in their
header, so everything is wrapped in `export module <Name> { … }` and the last
`}` in the file closes the module — the patches land at module level, which is
what `api2.dtos.ts` shows today.

The SDK's `hub2.dtos.ts` leaves `//GlobalNamespace:` commented out and has **no
wrapper**. The same regex then matched the closing brace of the *last class*,
and ten `export class` declarations were spliced into the body of
`GetAccessToken`:

```
src/types/hub2.dtos.ts(23982,5): error TS1068: Unexpected token. …
src/types/hub2.dtos.ts(24089,1): error TS1128: Declaration or statement expected.
```

The generator now checks for the wrapper and appends at file top level when
there is none, dedenting the one indent level the wrapper form carries. It also
exports its two post-processing functions and guards `main()`, so the pass can
be run against a file without a live gateway — that is how `hub2.dtos.ts` was
regenerated here, since nothing is serving metadata on `localhost:5001`.

The resulting diff is the block and nothing else: 10 classes, same order,
byte-identical bodies once indentation is normalised, one stray `}` removed.

Four regression tests now live in `sdks/typegen/tests/` — the first tests that
folder has ever held. They cover both file shapes, the idempotence of the
injection, and a file the patches do not target.

### #61 — the C# generics in the Go references (typegen + norbix-go)

`references/api.dtos.go` and `references/hub.dtos.go` carried three untranslated
C# constructs, so neither file parsed and `gofmt -l .` failed for the whole
repository:

| left in C# form | Go | occurrences |
|---|---|---|
| `HashSet<T>` | `[]T` | 5 fields |
| `MessageTranslation<T>` | `MessageTranslation` | 19 fields |
| `type N struct { []T }` | `type N []T` | `PushDevices` |

The fix is in the toolchain, not in the output: a new
`sdks/typegen/languages/go/reference/fix_csharp_generics.py` applies the three
rules and then runs `gofmt -w`. It is the Go counterpart of `sync-types.mjs`,
and it is idempotent — a second run reports nothing to do.

The mapping is not invented. The gateway's current `/types/go` output already
declares `type MessageTranslation[TContent any]`, refers to it without type
arguments at field sites, and writes `type PushDevices []PushDevice`; the rules
bring the checked-in reference into line with that.

Nothing under `./norbix/...` imports these files — they are reference material
— which is why a file that did not parse never broke anything shipped.

## Rejected / moved out

- **Refreshing `norbix-go/references/*.dtos.go` from a fresh gateway pull.**
  There is a 2026-09-15 pull of `/types/go` sitting untracked in
  `typegen/languages/go/reference/`, and it parses cleanly. Using it would have
  been one copy instead of a fixer. I did not, for two reasons: it drops 22 Api
  and 27 Hub types the committed file has (the `I*` marker structs, plus
  `Authenticate` and `GetAccessToken`), which I cannot explain from here; and
  every other generated artefact on `main` comes from the 2026-09-04 contract,
  so moving one SDK's references to a newer one makes the tree inconsistent.
  Refreshing every SDK from the current contract is a real job, but a separate
  one.
- **Running `prettier --write` over `src/types/hub2.dtos.ts`.** It would make
  `npx prettier --check .` stop warning about that file and would match
  `api2.dtos.ts`, which *is* formatted. It is also a 24,000-line reformat mixed
  into a 106-line fix, and the generator does not produce that formatting, so
  the next run would undo it. Left alone, flagged below.
- **Wrapping `hub2.dtos.ts` in `export module CodeMashHub2` by hand.** It would
  make `tsc` green in one stroke. It is also exactly the hand-patching of
  generated code that rule 5 forbids, on a 24,000-line file. Root cause and the
  real fix are below instead.
- **Fixing the gateway's manifest emitter.** Real, found, diagnosed — but it is
  a gateway change, and this slice's packet lists only SDK repositories and
  `typegen`. Written up below.
- **Formatting `.releaserc.json`, `ArchitectOverview.md`, `CHANGELOG.md`,
  `CONTRIBUTING.md`, `README.md` in norbix-js.** `prettier --check` already
  warned on all five before this branch. Not mine, not this slice.

## Needs you

1. **#43 cannot be done — the generator does not exist.** The packet says "run
   the typegen generator for both, diff against the tree, commit the generated
   changes". There is nothing to run. `sdks/typegen` has `core/fetch_contract.py`
   and `tools/measure.py`, and every `languages/<lang>/` folder contains only
   `out/.gitkeep`, `expected/.gitkeep`, `templates/.gitkeep` and a README that
   says *"Write `generate.py` here"*. No `generate.py` exists for any language;
   `tools/sync.py`, which the README also references, does not exist either.
   Neither `norbix-go` nor `norbix-python` ships a generator of its own. The
   hand-added `TestFilesIntegration` therefore has to stay hand-added for now.
   What I could verify instead: both SDKs are green and clean — Go
   `go test ./norbix/...` ok, `go vet` clean, `gofmt -l .` clean; Python 595
   passed, `make typecheck` clean; and neither repository has drifted since
   SDK-2 (route drift unchanged, below). **Reopen #43 once
   `typegen/languages/{go,python}/generate.py` exists.**

2. **`npx tsc --noEmit` in norbix-js is still not green, and #60 is not why.**
   The parse error was hiding two other breakages that have been on `main` all
   along. Neither is caused by this branch, and neither is a small fix:
   - **29 files import a type that nothing declares.** Every `src/hub/*.ts`,
     `src/webhooks/*.ts` and `tests/webhooks/event-data.test.ts` does
     `import type { CodeMashHub2 } from '../types/hub2.dtos.js'`, and
     `hub2.dtos.ts` contains no `CodeMashHub2` anywhere — 30 × `TS2305`.
     `generate-endpoints.mjs` hard-codes `typesNamespace: 'CodeMashHub2'` for
     the Hub target, exactly as it hard-codes `CodeMashApi2` for the Api target,
     and `api2.dtos.ts` *does* declare `export module CodeMashApi2`. So the Hub
     DTO file was regenerated at some point with `GlobalNamespace` commented out
     in its header, and `updateInPlace` preserves header options, so the mistake
     is now sticky. **The fix is one line in the file's own header —
     `GlobalNamespace: CodeMashHub2` instead of `//GlobalNamespace:` — followed
     by `npm run sync-types:remote` against a running gateway on port 5001.**
     I have no gateway to run it against, and hand-wrapping 24,000 lines is the
     wrong answer. Because all 29 are `import type`, they vanish at runtime —
     which is why the suite is green and only `tsc` complains.
   - **10 errors in `tests/sse/client.test.ts`** — `TS2532 Object is possibly
     'undefined'` and `TS2322 Type 'number' is not assignable to type
     'void | Promise<void>'`. Ordinary test-file strictness, unrelated to
     anything generated.

3. **The gateway's endpoint manifest under-reports, by roughly 35 routes.**
   This is what stopped me confirming every snapshot line from the manifest
   alone. Two independent causes, both in the emitter helpers:
   - `ApiServiceContractInfo.From` / its Hub twin take **one** request DTO per
     service class: `TryResolveRequestType` picks the first `Any`/`Get`/`Post`/
     `Put`/`Delete` method and stops. ServiceStack services routinely have
     several `Any(...)` overloads — `PasskeySignupService` has four — so every
     route but one is silently dropped. 32 of the 35.
   - `ApiServiceDiscovery` / `HubServiceDiscovery` only scan assemblies named
     `Isidos.CodeMash.Gateway.Api*` / `…Hub*` plus `…Community.*`.
     `Isidos.CodeMash.Services.Api` is in neither list, so `/{version}/echo`,
     `/{version}/public/projects/{ProjectId}/config` and
     `/{version}/public/projects/{ProjectId}/legal/{Kind}` are invisible. 3 of
     the 35.
   Until this is fixed, `endpoints.api.json` and `endpoints.hub.json` — and
   therefore the whole coverage matrix and the drift check — understate what
   the gateway serves. Suggest **#62** (one DTO per service) and **#63**
   (`Services.Api` not discovered). Note also that both emitter tests live only
   on the gateway branch `refactoringV2`, not on `master`.

4. **4 Notifications endpoints in the .NET SDK cannot build a URL.** Their
   request DTO has no settable property matching the route token, so the
   generated method is unusable. Visible in the new
   `EndpointCoverageTests.Hub.Notifications.verified.txt`, and one of them was
   already snapshotted this way during SDK-2:
   `DeleteEmailCampaign` (`…/email/campaigns/{Id}` — the DTO has **no
   properties at all**), and `GetEmailCampaignMessage` /
   `GetPushCampaignMessage` / `GetSmsCampaignMessage` (`…/messages/{id}` — the
   DTOs have `CampaignId`, `CampaignBatchId`, `NotificationId`, but no `Id`).
   Either the gateway route tokens or the generated DTOs are wrong; that is a
   contract question, not something to paper over in a test. Suggest **#64**.

5. **`sdks/typegen` is committed but not pushed — your call.** The packet said
   "commit directly if it is not a repo". It *is* a git repository, with a
   remote (`codemash-io/sdks-typegen`), no branch protection, and `main` one
   commit ahead of `origin/main` — which means the 100,000 lines of
   `core/contract.raw.*.json` and both TypeScript generators exist on one laptop
   and in no backup, which is the failure that folder was created to prevent.
   My commit `14a505b` sits on top of that. I did not push: the remote returns
   404 to this account, so I cannot verify it is the right place, and pushing
   would also publish someone else's unpushed commit. **Please push it, or tell
   me where it should go.**

6. **Two other sessions are working in trees I had to read.** Nothing of theirs
   was committed, but you should know:
   - `sdks/typegen` has untracked `languages/go/reference/`, `languages/ruby/`,
     `languages/rust/` and a modified `README.md`. Left exactly as found.
   - The `gateway` main checkout is on `refactoringV2` with uncommitted edits to
     `ReceivePaymentsWebhook.cs` and `Receive.cs`. Running the Hub emitter there
     (Routine C) picked those up and turned two `Response` fields into
     `<unknown>`. I restored `endpoints.hub.json` to its committed-gateway state
     so the manifest does not record work in progress.
   - `sdks/norbix-js` main checkout is on `chore/regen-types-from-gateway` with
     uncommitted changes. I never touched it; all work was in a worktree.

## Open questions

- **Should generated DTO files be prettier-formatted?** `api2.dtos.ts` is,
  `hub2.dtos.ts` is not, and `prettier --check` fails because of the
  difference. Either add both to `.prettierignore` or run the formatter over
  both as part of the sync — but pick one, because right now the repository
  disagrees with itself.
- **Are `references/*.dtos.go` meant to be in the public Go repository at all?**
  `typegen/README.md` says the raw `/types/<lang>` output must **never** be
  copied into an SDK repo, because it carries the upstream framework name. The
  committed files are that raw output, headers included
  (`//AddServiceStackTypes: True`). I fixed them because #61 asked me to, but
  the rule says they should not be there.
- **Which gateway is the source of truth for the contract?** The manifest
  emitters are on `refactoringV2`, the checked-in DTOs come from a 2026-09-04
  pull, and there is a 2026-09-15 pull lying around that disagrees with both.
  SDK-4 will hit this the moment it regenerates anything.

## Evidence

```
norbix-net   dotnet test Norbix.Sdk.sln         142 passed, 0 failed   (audit ON, no -p:NuGetAudit=false)
                 Norbix.Sdk.Tests                52 passed  —  6 Api modules,  77 endpoints
                 Norbix.Hub.Tests                90 passed  — 21 Hub modules, 489 endpoints
norbix-go    go test ./norbix/...               all packages ok
             go vet ./norbix/...                clean
             gofmt -l .                         clean
norbix-js    npx vitest run                     706 passed (40 files)
             npm run lint                       clean
             npx tsc --noEmit                   40 errors, all pre-existing — see "Needs you" 2
norbix-python uv run pytest                     595 passed
             make typecheck                     clean, 36 source files
typegen      node --test 'tests/*.test.mjs'     4 passed

Routine C    build_matrix.py                    546 endpoints, 18 modules — unchanged
             check_route_drift.py               65 drifted routes — unchanged, has not grown
```
