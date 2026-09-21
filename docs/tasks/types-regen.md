# TYPES-REGEN — regenerate every SDK's types from the gateway (issue #68)

Campaign: Norbix Files testing, slice **TYPES-REGEN**. One agent, nine
worktrees, branch `chore/types-regen` in every repo it touched.

## Goal

Every SDK data type (a "DTO" — the plain object that carries a request or a
response over the wire) comes from the **running gateway**, never from
somebody typing it out. Delete the hand-written copies that slices SDK-2 and
API-TEST added while type generation was frozen, run each repo's own
regeneration, and prove the existing tests still pass — that is what shows the
generated types have the same shape as the hand-written ones.

**Not in scope:** new SDK methods, new endpoints, file triggers, changes to
the gateway (read-only here), and the ground-up rewrite of the generator
toolchain, which is its own task (`gateway/docs/tasks/sdk-type-generation.md`).

## Plan

| # | Step | Status |
|---|---|---|
| 1 | Run the gateway locally (Community.Hub :5001, Community.Api :5002) from `refactoringV2` | done |
| 2 | One worktree per repo, branch `chore/types-regen` | done |
| 3 | Find each repo's real regeneration entry point | done |
| 4 | norbix-js — regenerate, build, test | done |
| 5 | norbix-net — delete the hand-written files, regenerate, build, test | done |
| 6 | norbix-swift — regenerate the references, build | done |
| 7 | norbix-go — regenerate | **dropped** — the repo has no generator, see *Rejected / moved out* |
| 8 | norbix-python · norbix-kotlin · norbix-dart · norbix-react-redux | done — nothing to regenerate, see below |
| 9 | Diff review per repo: what appeared, changed, disappeared | done |
| 10 | Routine C — endpoint manifests + route drift | done |
| 11 | Routine A — push and open the pull requests | **for the main chat** |

## Status table

One row per repo. "Generated types" means types the repo commits and does not
write by hand.

| Repo | Generated types? | Regeneration entry point | Result | Evidence |
|---|---|---|---|---|
| **norbix-js** | yes — `src/types/{api2,hub2}.dtos.ts` | `npm run sync-types:remote` + `npm run generate-endpoints` | ✅ regenerated; 14 types arrived, none lost | commits `d61889f`, `69cfedd`; lint, `tsc --noEmit`, **739/739 tests**, build all green in the worktree |
| **norbix-net** | yes — `src/Norbix.Sdk.Types/Generated/*.dtos.cs` | none existed → written as `typegen/languages/csharp/generate.py` | ✅ regenerated; 5 hand-written files deleted | commit `7772ec6`; build green, **144/144 tests** (Sdk 54 + Hub 90) |
| **norbix-swift** | only `references/*.dtos.swift` | `make sync-types` | ✅ references regenerated; 27 types arrived, none lost | commit `85be777`; `swift build` green. `make generate` not run — see *Rejected* |
| **norbix-go** | yes — `norbix/{api,hub}/dtos/dtos.go` (12 600 lines) | **none** — `gen_dtos.py` is gitignored and not on disk | ⛔ blocked, nothing changed | `norbix-go/.gitignore` has no script entry and `scripts/` does not exist; every generated file's header names `gen_dtos.py`. Repo left green: `go test ./norbix/...` passes, `go vet` clean, `gofmt -l` empty |
| **norbix-python** | **no** | — | ➖ nothing to regenerate | `src/norbix_python/models.py` is 21 lines and 2 hand-written models; every module method takes `**request: Any` and returns `Any` (`src/norbix_python/api/files.py`) |
| **norbix-kotlin** | **no** | — | ➖ nothing to regenerate | `src/main/kotlin/ai/norbix/sdk/api/FilesModule.kt` — every method is `Map<String, Any?>` in, `Any?` out; no `data class` anywhere in the shipped modules |
| **norbix-dart** | **no** | — | ➖ nothing to regenerate | `lib/src/api/resources/files.dart` — every method is `Object?` in, `Future<Object?>` out |
| **norbix-react-redux** | **no** | — | ➖ nothing to regenerate | no `*dtos*` file in `src/`; it takes its types from the published `@norbix.ai/ts` package |
| **cli** | **no** | — | ➖ not affected | depends on the **published** `@norbix.ai/ts@^1.3.0`, so it only sees these changes after a release |
| **typegen** (private) | — | — | ✅ two generators fixed, one written | commits `e56b406`, `1199f67` |

## Changes

### norbix-js — `d61889f`, `69cfedd`

`npm run sync-types:remote` regenerates `src/types/*.dtos.ts` straight from the
running gateway; `npm run generate-endpoints` then rebuilds the module methods,
their tests and the docs from those types.

Every hand-written block is gone and comes back generated, under the same name:
`GetPublicFileRequest`, `PublicFolderDto`, `IntegrationTestResultItemDto`,
`TestFilesIntegrationResponse`, `TestFilesIntegrationRequest`, and the
`publicUrl` / `isPublic` / `publicFolders` fields.

**Types that arrived — 14. Types that disappeared — none.**

* API surface (2): `GetFileContentRequest`, `PutFileContentRequest`.
* Hub surface (12): `MarketplaceFunctionTriggered`, the eight push-campaign
  events (`PushBatchRegistered`, `PushCampaign{Completed,Failed,Started,Stopped,Triggered}`,
  `PushNotification{Clicked,Read}`), and `Fake{Email,Push,Sms}IntegrationDto`.

Four faults in the generator had been worked around by editing generated files
by hand. All four are fixed in the generator (see *typegen* below), not in the
output. Two more faults were in the SDK's own code:

* **`src/client/transport.ts`** looked a path token up by its exact spelling.
  The routes are copied from the gateway exactly as it writes them, and the
  gateway writes some tokens with a capital — `{PublicId}`, `{Name*}`, `{Id}` —
  while the field on the request object is always camelCase. So
  `getPublicFile({ publicId, name })` threw "Missing path parameter" although
  the caller had passed both. The lookup now tries the exact name first, then
  ignoring case. This was live on `main` for every `{Id}` route, a dozen of
  them; no test covered it because the generated tests pass the token spelling
  back verbatim.
* **`tests/_helpers.ts`** kept the `*` of a catch-all token in the field name,
  so a route ending `{Name*}` looked for a field called `name*`.

### norbix-net — `7772ec6`

Five hand-written files deleted, because every type in them now arrives
generated with the same name and the same shape:

```
src/Norbix.Sdk.Types/PublicFilesEndpoints.Api.cs          (issue #68)
src/Norbix.Sdk.Types/FilesIntegrationTestEndpoints.Api.cs (issue #68)
src/Norbix.Hub.Types/PublicFilesEndpoints.Hub.cs          (issue #68, not listed there)
src/Norbix.Sdk.Types/PasswordEndpoints.cs                 (same pattern, older)
src/Norbix.Sdk.Types/TaxonomyTreeEndpoints.cs             (same pattern, older)
```

`src/Norbix.Sdk.Types/PushCampaignEndpoints.cs` stays: seven of its nine types
still have no counterpart in the gateway metadata. It is listed under *Open
questions*.

**Contract changes the regeneration brought in:** `GetFileContentRequest`,
`PutFileContentRequest`, `TestFilesIntegrationRequest` (API surface),
`GetPublicFileRequest`, `PublicFolderDto`, `ChangePasswordRequest`,
`ConfirmPasswordResetRequest`, `RequestPasswordResetRequest`, and the
`PublicFolders` field on the two listing responses. **Nothing disappeared** —
no coverage snapshot lost an endpoint.

Seven Verify snapshots updated. Two carry genuinely new endpoints
(`GetFileContentAsync`, `PutFileContentAsync` — both checked against the
gateway's own `[Route]` attributes before accepting, as issue #44 asks); the
other five changed only in ordering, with the same set of methods before and
after.

### norbix-swift — `85be777`

`make sync-types` refreshed `references/{api,hub}.dtos.swift`, the only
generated artefact this repo commits. 27 types arrived, none disappeared: the
public-file and file-content requests, the four make-public / make-private
requests, `PublicFolderDto`, `TestFilesIntegration` and its result item, the
three password requests, the push-campaign events and the three
fake-integration DTOs.

### typegen (private) — `e56b406`, `1199f67`

**TypeScript generator, four fixes.** Each one had been corrected in the output
by hand after every previous run:

1. The `@sdk-dto-patches` block landed **outside** `export module CodeMashApi2`,
   because the check for the wrapper only matched a `{` on the same line as the
   name and the exporter puts it on the next line. Nine types stopped
   resolving.
2. Endpoints that need no sign-in, and endpoints that answer with bytes, came
   out as ordinary signed-in JSON calls. The type file cannot express either,
   so `sync-types` now writes what the gateway knows into
   `src/types/*.contract.json` and the codegen reads it — the codegen itself
   stays offline.
3. Generated test files imported the package entry point before the module,
   which the repo's lint rule rejects.
4. The hub namespace appended its two hand-written modules after the sorted
   ones — same lint rule.

**C# generator, newly written** (`languages/csharp/generate.py`). The header of
`norbix-net`'s generated types has always said *"Regenerated by internal
contract workflow"*. That workflow was a list of hand steps in a design
document — export, strip the header, strip the usings, flatten the namespaces,
rename the markers — so nobody could run it, which is exactly why those files
kept being edited by hand. It is a script now, and running it twice leaves the
output byte-identical. Beyond the mechanical steps it handles three things the
export gets wrong for an SDK:

* **Requests that must carry no `Authorization` header.** Four facts from the
  gateway metadata have to agree: it answers with raw bytes, the gateway does
  not authenticate it, and it carries neither a project id nor an account id.
  That describes a *link* — a URL opened by whoever holds it — and it picks out
  the public file link and the signed content link, the same two the SDK used
  to mark by hand. The first version of this rule read only "the gateway does
  not authenticate it" and would have dropped the token on 28 endpoints,
  including `echo`, creating an account and the passkey ceremonies. Those are
  open, but sending a token to them is harmless, and changing that was never
  the point. The TypeScript rule was narrowed to match.
* **Interface members no class implements.** The gateway declares
  `IHasDomainEntityId.ViewId` as a computed, read-only property: no DTO stores
  it and it never crosses the wire. The newer export tool writes it into the
  interface all the same, and the SDK stopped compiling with a dozen *"does not
  implement interface member"*. Older exports left the interface empty, which
  is why this only appeared on a tool upgrade (10.08 → 10.20).
* **A type written once per referencing namespace.** Harmless while the
  namespaces stay separate; once they are flattened into one it becomes
  *"IHasAccountId already contains a definition for AccountId"*. Identical
  repeats are emitted once. A repeat with a **different** body is kept and
  reported, because that is a real name clash and dropping one would ship the
  wrong shape.

### Routine C — manifests and route drift

`endpoints.hub.json` regenerated (485 endpoints). Route drift measured against
the gateway source with the regenerated worktrees in place:

| SDK | drifted routes |
|---|---:|
| NET | 3 |
| TS | 6 |
| Go | 16 |
| Python | 16 |
| Kotlin | 18 |
| Swift | 3 |
| Dart | 3 |
| **total** | **65** |

The same 65 as before the regeneration, and both halves of that are worth
knowing:

* **12 of the 65 are the checker being wrong, not the SDKs.** `/{version}/echo`
  and the two `/{version}/public/projects/...` routes are reported as
  "the gateway does not serve this" for NET, TS, Swift and Dart. The gateway
  does serve them — they are declared in `src/Isidos.CodeMash.Services.Api/`
  (`Heartbeat/Echo.cs`, `Heartbeat/PublicProjectConfig.cs`), a shared assembly
  that `check_route_drift.py` files under Hub only.
* **3 of the 65 are real and are ours.** The TypeScript patch list keeps three
  notification endpoints alive that the gateway no longer serves —
  `/{version}/notifications/user/preferences` and two
  `/{version}/notifications/contacts/{contactId}/marketing-state/...` routes.
  The gateway moved that work to `/{version}/membership/users/{contactId}/...`.
  Removing them drops three public methods from `@norbix.ai/ts`, which is a
  breaking change, so it is under *Needs you* rather than done here.
* The remaining 50 are Go, Python and Kotlin, which cannot be regenerated at
  all (see below) — the drift there is a symptom, not a cause.

## Rejected / moved out

* **Regenerating norbix-go.** The repo genuinely has no generator. Every
  generated file names `gen_dtos.py` / `gen_modules.py` in its header, neither
  is in the repository or on disk, and the DTOs were produced from a
  *TypeScript snapshot*, not from the gateway — a copy of a copy. Writing a new
  Go generator that reproduces 12 600 lines faithfully is step 4 of
  `sdk-type-generation.md`, a task with its own brief, not something to improvise
  inside this slice. Following the packet, I stopped rather than hand-write.
  **The two hand-written files from issue #68 were therefore left in place**:
  `norbix/api/files_integration_probe.go` and
  `norbix/api/dtos/files_integration_probe.go`. Deleting them today would take
  `TestFilesIntegration` out of the Go SDK and give nothing back. Both files say
  so themselves in their header comment, and they cannot collide with anything
  until a regeneration exists. norbix-go is untouched and green.
* **Regenerating norbix-swift's module layer.** `make sync-types` works, but
  `make generate` writes into `Sources/NorbixSwift/` and
  `Tests/NorbixSwiftTests/` — a single-module layout the repo left behind for
  `NorbixCore` / `NorbixApi` / `NorbixHub` — and its docs pass deletes pages the
  repo still ships. Its output is also far poorer than what is committed:
  `Sources/NorbixApi/Modules/FilesModule.swift` carries typed enums, custom
  decoding and written documentation that no generator produced. That module
  layer is hand-written by intent; only `references/` is generated. I reverted
  the stale generator's output and left the modules alone.
* **Refreshing `references/` in norbix-go, norbix-python, norbix-kotlin and
  norbix-dart.** Those files are snapshots of the contract that nothing in the
  build reads — Go's carry `//go:build ignore`, Python's and Kotlin's are not
  imported anywhere. Refreshing them would produce a large diff whose only real
  content is a new timestamp. Left alone deliberately.
* **Deleting the three dead notification types from the TypeScript patch list.**
  A breaking change to a published package; see *Needs you*.
* **Deleting `src/Norbix.Sdk.Types/PushCampaignEndpoints.cs`.** Seven of its
  nine types are still not in the gateway metadata, so it is not a duplicate
  yet. See *Open questions*.

## Needs you

- [ ] **Open and merge the pull requests** (Routine A). Four branches, all named
      `chore/types-regen`, all committed and rebased in their worktree:
      `norbix-js`, `norbix-net`, `norbix-swift`, and the private `typegen` repo.
      Order matters only in that `typegen` holds the generators the other three
      were produced with — merge it first, or at the same time.
- [ ] **Decide on the three dead TypeScript notification methods.**
      `getUserNotificationPreferences`, `grantContactConsent` and
      `unsubscribeContact` in `@norbix.ai/ts` call routes the gateway stopped
      serving. Removing them is a breaking change for customers (SDK management
      rule 4), so it needs your word. They are kept alive by the patch list in
      `typegen/languages/typescript/reference/sync-types.mjs`.
- [ ] **Install a full Xcode on this Mac, or say that Swift tests run in CI
      only.** `swift test` cannot run here: `XCTest` is missing because
      `xcode-select` points at `/Library/Developer/CommandLineTools` and only
      `Xcodes.app` (the version manager) is installed, not Xcode itself. The
      same failure happens on an untouched `origin/main` checkout, so it is the
      machine, not the change. `swift build` is green.
- [ ] **Say whether a Go generator is worth building now.** Until one exists,
      norbix-go cannot follow a gateway contract change at all, and issue #68's
      two Go files cannot be removed. This is `sdk-type-generation.md` step 4
      for Go.

## Open questions

* **Is `IsPublic` / `PublicUrl` meant to be on `FileResourceRefDto`?** The
  gateway's `FileResourceRefDto` has four fields (`resource`, `integrationId`,
  `provider`, `path`). Slice SDK-2 added `publicUrl` and `isPublic` to it by
  hand in TypeScript and .NET. After the regeneration they are gone from the
  DTO — the gateway does not put them there. The public-file information the
  gateway *does* send is `PublicFolders` on the listing responses and
  `PublicFolderDto`. If a caller is supposed to read `isPublic` off a single
  file, the gateway has to grow the field; the SDKs cannot invent it.
* **`PushCampaignEndpoints.cs`** in norbix-net still hand-writes nine types, of
  which only `DeletePushCampaignRequest` and `StopPushCampaignRequest` now
  come from the gateway. Are `PushToUsersRequest`, `PushToDevicesRequest`,
  `PushToAllUsersRequest`, `PushToCollectionRecordsRequest`,
  `PushToAccountUsersRequest`, `PushDeviceDeliveryTokenRequest` and
  `FakePushIntegrationRequest` endpoints the gateway is supposed to expose? If
  so the file goes away at the next regeneration; if not, it is a permanent
  hand-written exception and should say why.
* **`check_route_drift.py` files `Services.Api` routes under Hub only**, which
  is 12 of the 65 reported drifts. Worth fixing before anyone treats that total
  as a score.
