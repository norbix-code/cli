# 10b Files — SLICE SDK-2: the public-files endpoints in the SDKs and the CLI

Campaign 10b-files, slice **SDK-2**. It follows slice **PUB**, which built
public file links in the gateway and the dashboard, and slice **SDK**, which
brought the other 20 Files endpoints into the four SDKs and the CLI.

## Goal

Slice PUB added five addresses to the gateway and two fields to the file DTOs.
No SDK and no CLI command knew they existed. This slice gives every shipped SDK
(.NET, Go, TypeScript, Python) a method for each, a test that runs green, and a
documentation page where the repository has one; and gives the CLI a
`norbix files publish` / `unpublish` pair.

**Not in scope:** file triggers · Dart, Kotlin, Swift, React-Redux (report
only) · the documentation repository `docs/codemash-docs` (slice DOC-2 owns
it) · regenerating shared types from `sdks/typegen` · any gateway change (I
only read it, and ran the two manifest emitters it ships).

## Worktrees and branches — all five pushed, nothing merged by me

| repo | worktree | branch | **branched from** |
|---|---|---|---|
| norbix-net | `~/Projects/norbix/worktrees/sdks/norbix-net/test/files/SDK-2` | `test/files/SDK-2` | **`test/files/SDK`** |
| norbix-go | `~/Projects/norbix/worktrees/sdks/norbix-go/test/files/SDK-2` | `test/files/SDK-2` | **`test/files/SDK`** |
| norbix-python | `~/Projects/norbix/worktrees/sdks/norbix-python/test/files/SDK-2` | `test/files/SDK-2` | **`test/files/SDK`** |
| norbix-js | `~/Projects/norbix/worktrees/sdks/norbix-js/test/files/SDK-2` | `test/files/SDK-2` | `origin/main` |
| cli | `~/Projects/norbix/worktrees/sdks/cli/test/files/SDK-2` | `test/files/SDK-2` | `origin/main` |

**The packet says "from `origin/main`", and three of the five are not.** Here is
why, because it changes how the pull requests must be merged.

Slice SDK's pull requests are **still open** in `norbix-net`, `norbix-go` and
`norbix-python` — only the `cli` one was merged (`e192231 Merge branch
'test/files/SDK'`). Branching those three from `origin/main` would have meant
working without the things slice SDK built and this slice needs:

- **norbix-net**: the `byte[]` fix in `HttpTransport`. A public link answers
  with a file; on `origin/main` every such call still throws "Failed to
  deserialize response". Re-doing that fix on a second branch would have
  guaranteed a conflict.
- **norbix-go**: `norbix/files_test.go`, the only Files test file.
- **norbix-python**: `tests/test_files_routes.py`, the only test that checks a
  Files route rather than "the URL starts with https" (K23).

So those three branches are **stacked**: a pull request from `test/files/SDK-2`
to `main` carries slice SDK's commits as well as mine. See "Needs you".

## What it does now, in one paragraph

Somebody with an SDK client can call `makeFilePublic` on a file (or
`makeFolderPublic` on a prefix) and get back an `nbpf_…` id; the file's
`publicUrl` and `isPublic` then come back with every listing. Anyone at all —
no SDK, no account, no session — can read that link, and each SDK has a
`getPublicFile` that does it **without sending an `Authorization` header**,
even when the client it is called on is signed in. From a terminal it is
`norbix files publish invoices/2026/invoice.pdf`, which prints the link.

## Plan

| # | Step | Status |
|---|---|---|
| 0 | Task file, worktrees, base-branch decision | done |
| 1 | Gateway (read-only): regenerate the endpoint manifests, rebuild the coverage matrix, confirm the five show as `no` | done |
| 2 | TypeScript — 5 methods, the DTO fields, 15 tests, both documentation pages | done |
| 3 | Python — 5 methods sync and async, 13 tests, both documentation pages | done |
| 4 | Go — 5 methods, 10 tests | done |
| 5 | .NET — 5 methods, the DTO fields, 13 tests, README | done |
| 6 | CLI — `files publish` / `unpublish`, 7 tests, README | done |
| 7 | `sdks/tests/coverage/modules/files.md` updated in place | done |
| 8 | Report; five branches pushed; pull requests listed | done |

## STATUS TABLE — endpoint × language

`M` method exists · `T` test exists **and was run and passed** · `D` documented
in that repository. Evidence paths are under the table.

| Endpoint | .NET | Go | TS | Py | CLI |
|---|---|---|---|---|---|
| `MakeFilePublic` (Hub) | M T D | M T D | M T D | M T D | M T D |
| `MakeFilePrivate` (Hub) | M T D | M T D | M T D | M T D | M T D |
| `MakeFolderPublic` (Hub) | M T D | M T D | M T D | M T D | M T D |
| `MakeFolderPrivate` (Hub) | M T D | M T D | M T D | M T D | M T D |
| `GetPublicFile` (API, no auth) | M T D | M T D | M T D | M T D | ➖ |
| `IsPublic` + `PublicUrl` on a file | T | T | T | — | ➖ |
| `PublicFolders` on a listing | T | T | T | — | ➖ |

`D` for .NET and Go is the README section and the method comments — neither
repository has per-module documentation pages (slice SDK, "Needs you": a
whole-repository decision, not a Files one). `➖` on the CLI: it has no command
for the public link itself, because the link is a plain address anything can
open. `—` on the Python rows: the Python SDK is untyped (`**request` in,
`dict` out), so the two new fields need no declaration and nothing would be
proved by asserting a dictionary carries what the fake transport put in it.

### Where the evidence is

| What | File | Result |
|---|---|---|
| .NET Hub, 6 tests | `norbix-net/tests/Norbix.Hub.Tests/HubPublicFilesEndpointTests.cs` | 18 passed in that project (12 before) |
| .NET API, 7 tests | `norbix-net/tests/Norbix.Sdk.Tests/PublicFileEndpointTests.cs` | 47 passed, 5 failed — the 5 are pre-existing, see F7 |
| .NET generated coverage | `norbix-net/tests/Norbix.Sdk.Tests/test_results/EndpointCoverageTests.Api.Files.verified.txt` | 8 endpoints → 9 |
| Go, 10 tests (14 cases with sub-tests) | `norbix-go/norbix/files_public_test.go` | `go test ./norbix/...` all green; 37 cases in the package (23 before) |
| TypeScript, 15 tests | `norbix-js/tests/files-public.test.ts` | `npx vitest run` — 706 passed in 40 files |
| Python, 13 tests | `norbix-python/tests/test_public_files.py` | `uv run pytest` — 537 passed (524 before) |
| CLI, 7 tests | `cli/test/files.test.ts` | `npm test` — 42 passed (35 before) |

Commands used, each **inside its own worktree**:
`dotnet test Norbix.Sdk.sln -p:NuGetAudit=false` ·
`go test ./norbix/...` · `npx vitest run` · `uv run pytest` · `npm test`.

Also run and green: `norbix-python` `make typecheck` (mypy, 36 files, no
issues) · `norbix-go` `go vet ./norbix/...` and `gofmt -l` (clean) ·
`norbix-js` `npm run lint` and `prettier --check` (clean) · `cli`
`tsc --noEmit` (clean).

## Changes

### norbix-js (TypeScript) — branch `test/files/SDK-2` from `origin/main`

| file | what changed |
|---|---|
| `src/hub/files.ts` | `+ makeFilePublic / makeFilePrivate / makeFolderPublic / makeFolderPrivate` |
| `src/api/files.ts` | `+ getPublicFile` — `scope: 'unauthenticated'`, `responseType: 'binary'` |
| `src/client/transport.ts` | `+ responseType: 'json' \| 'binary'`; wildcard path tokens (`{name*}`) |
| `src/types/hub2.dtos.ts` | `+ PublicFolderDto`, the 4 request DTOs, `FileResourceRefDto.isPublic/.publicUrl`, `GetFolderFilesResponse.publicFolders` |
| `src/types/api2.dtos.ts` | `+ GetPublicFileRequest`, `PublicFolderDto`, the two file fields, `ListFilesResponse.publicFolders` |
| `tests/files-public.test.ts` | new — 15 tests |
| `docs/hub/files.md`, `docs/api/files.md` | new sections |

### norbix-python — branch `test/files/SDK-2` from `test/files/SDK`

| file | what changed |
|---|---|
| `src/norbix_python/hub/files.py` | `+` the four methods, sync and async |
| `src/norbix_python/api/files.py` | `+ get_public_file`, sync and async |
| `src/norbix_python/transport.py` | `+ response_type="binary"` and `follow_redirects`, on both transports |
| `tests/test_public_files.py` | new — 13 tests |
| `docs/hub/files.md`, `docs/api/files.md`, both `_index.md` | new sections, counts corrected |

### norbix-go — branch `test/files/SDK-2` from `test/files/SDK`

| file | what changed |
|---|---|
| `norbix/hub/files.go` | `+` the four methods |
| `norbix/api/files.go` | `+ GetPublicFile` |
| `norbix/internal/transport/transport.go` | `Send` copies the raw body into `out` when `out` is a `*[]byte` |
| `norbix/files_public_test.go` | new — 10 tests |

### norbix-net (.NET) — branch `test/files/SDK-2` from `test/files/SDK`

| file | what changed |
|---|---|
| `src/Norbix.Sdk.Types/INorbixUnauthenticated.cs` | new — marks a request that must send no `Authorization` header |
| `src/Norbix.Hub.Types/PublicFilesEndpoints.Hub.cs` | new — the 4 request DTOs, `PublicFolderDto`, the two file fields, `GetFolderFilesResponse.PublicFolders` |
| `src/Norbix.Sdk.Types/PublicFilesEndpoints.Api.cs` | new — `GetPublicFileRequest` and the API-side DTO additions |
| `src/Norbix.Sdk.Generators/EndpointSourceGenerator.cs` | honours `INorbixUnauthenticated`; strips the `*` from a wildcard path token |
| `src/Norbix.Sdk/Transport/HttpTransport.cs` | wildcard path tokens keep their slashes |
| `src/Norbix.Contracts/*.csproj`, `src/Norbix.Sdk.Types/*.csproj` | the new marker interface is compiled into the shared contracts assembly |
| `tests/Norbix.Hub.Tests/HubPublicFilesEndpointTests.cs` | new — 6 tests + 6 snapshots |
| `tests/Norbix.Sdk.Tests/PublicFileEndpointTests.cs` | new — 7 tests + 4 snapshots |
| `tests/…/EndpointCoverageTests.Api.Files.verified.txt` | re-blessed: 8 endpoints → 9 |
| `README.md` | new "Public File Links" section; the `files` row corrected (see F8) |

**No generated file was edited.** The DTOs are hand-written `partial` classes
next to the generated ones, so the next regeneration simply replaces them.

### cli — branch `test/files/SDK-2` from `origin/main`

| file | what changed |
|---|---|
| `src/commands/files/publish.ts`, `unpublish.ts` | new — both with `--folder` |
| `src/lib/publicFiles.ts` | new — sends the four Hub requests (see F5) and builds the link to print |
| `test/files.test.ts` | `+` 7 tests |
| `README.md` | the two commands, and what `publish` is that `sign` is not |
| `docs/tasks/10b-files-SDK-2.md` | this report |

### outside any repository

`sdks/tests/coverage/modules/files.md` — regenerated, with a dated note saying
the five new rows are true of the branches and not yet of `main`, and what a
`yes` on that page does and does not mean.

## What was actually wrong (findings)

**F1 — every SDK would have mangled a public folder link, and two of them
did.** A folder link puts the path inside the folder after the id
(`…/nbpf_folder1/2026/q1/report.pdf`) and those slashes are real separators.
TypeScript and .NET both ran the value through `encodeURIComponent` /
`Uri.EscapeDataString`, turning it into `2026%2Fq1%2Freport.pdf`, and the
gateway route would not have matched — every folder link a 404. The .NET test
`A_folder_relative_path_keeps_its_slashes` recorded exactly that on its first
run. Both now understand a wildcard token (`{name*}`): each segment is escaped
on its own, slashes survive. Go and Python substitute path parameters without
escaping at all, so they were accidentally right; their tests pin it.

**F2 — three of the four SDKs cannot read a file at all, and it is not only
this endpoint.** Each transport parses every successful body as JSON:

- TypeScript `send()` does `JSON.parse(text)` — and `api.files.downloadFileApi`
  already declares `Promise<Blob>`. It has never been able to work. Slice SDK
  marked TypeScript "20/20, no change needed"; the tests there mock the
  transport, so nothing exercised the parse.
- Python `send()` does `response.json()` and silently falls back to
  `response.text` — a PDF comes back as mojibake rather than an error, which is
  worse.
- Go unmarshals into `out` and fails with "failed to decode response".

Each got a narrow way to ask for bytes (`responseType: 'binary'`,
`response_type="binary"`, `out *[]byte`) — the same shape as the fix slice SDK
made in .NET. **`downloadFileApi` is still broken in TypeScript and Python**:
the fix is now one argument away, but changing that method's return type is a
public-surface change outside this slice. See "Needs you".

**F3 — Python never followed a redirect, so a public file on S3 would have
looked empty.** When the provider signs its own links (Amazon S3, Azure Blob,
Google Cloud Storage) the gateway answers `302` and expects the client to
follow. `httpx` does not follow redirects by default, and the SDK never asked
it to: the `302` has no body, so `send()` returned `None` and the caller saw an
empty file with no error — K4 / K10 in transport form. `get_public_file` passes
`follow_redirects=True`; the test
`test_it_follows_the_redirect_a_signing_provider_answers_with` fails without
it. TypeScript (`fetch`), Go (`net/http`) and .NET (`HttpClient`) all follow
redirects by default.

**F4 — the TypeScript SDK does not compile, and has not for a while.**
`npm run typecheck` and `npm run build` both fail on `origin/main`, before any
change of mine:

```
src/types/hub2.dtos.ts(23885,5): error TS1068: Unexpected token…
src/types/hub2.dtos.ts(23992,1): error TS1128: Declaration or statement expected.
```

`scripts/sync-types.mjs` injects a block marked
`// @sdk-dto-patches (injected by sync-types.mjs)` **inside** the last generated
class instead of after it, so the file does not parse. And that is only half:
`hub2.dtos.ts` has also lost its `export module CodeMashHub2 { … }` wrapper —
`api2.dtos.ts` still has one at line 19 — so every `import type { CodeMashHub2 }`
resolves to nothing once the file does parse. The script itself is not in the
repository (K24). `npm test` is green throughout, because `import type` is
erased before anything parses the file, so the published package is built
by… nobody: `prepublishOnly` runs `npm run build`, which fails. I did **not**
fix it — it is a regeneration problem across the whole repository, not a Files
one, and a one-brace patch would have hidden the missing namespace. See
"Needs you".

**F5 — the CLI cannot call the new endpoints through the SDK yet.** It depends
on the published `@norbix.ai/ts@^1.2.0`, which has no method for them — the
methods are in the commit before it, in a branch. So `src/lib/publicFiles.ts`
sends the request itself, with exactly the headers the SDK's transport sends;
one test checks `Authorization`, `X-CM-ProjectId` and `nb-region` are all
there. The file says, at the top, that it should be deleted once the dependency
is bumped.

**F6 — `.NET` had no way to say "send no `Authorization`" except by path.** The
source generator decided it from the route: `/auth` and `/auth/*`. A public
file link is the first endpoint anywhere else that must send none, so the DTO
now says so itself with `INorbixUnauthenticated`, and the generator reads the
marker. Two tests make it mean something: the call goes out with no header even
when an API key is configured, **and** `ListFilesAsync` on that same
credential-less client is still refused with `NORBIX_NOT_AUTHENTICATED`.

**F7 — pre-existing red in `norbix-net`, unchanged by this slice.** Five
generated coverage snapshots still fail: `Api.Chat`, `Api.Database`, `Api.Echo`,
`Api.Membership`, `Api.Public`. Five before this slice, five after — slice SDK
reported them as F9. `dotnet test` also still needs `-p:NuGetAudit=false` to
restore at all.

Related, and new: a Verify test whose `.verified.txt` is missing leaves an
**empty** one behind (`EndpointCoverageTests.Api.Public.verified.txt` was three
bytes — a byte-order mark and nothing else). Commit one of those by accident and
the test passes forever with no content, which is K30 with the safety catch
filed off. I deleted the one that appeared and did not commit it. Every
snapshot this slice adds was read line by line before it was accepted.

**F8 — the .NET README's module table was already wrong.** It said `files | 15`;
the generated Hub DTOs declare 18 Files routes. With the four new ones it is 22,
which is what the row now says — the number was not simply bumped by four.

**F9 — the coverage page is generated, so slice SDK's hand-written one is
gone.** `sdks/tests/coverage/modules/files.md` was rewritten by hand on
2026-09-11 "from verified facts"; the first `build_matrix.py` run — step 1 of my
own packet — overwrote all of it. Anything worth keeping on that page has to
survive regeneration.

And the matcher behind it is a case-sensitive verbatim substring search, so
`GetPublicFile` read as missing in .NET, Go and Python purely because the
gateway spells the route `/{version}/files/public/{PublicId}/{Name*}` and the
SDKs write `{publicId}/{name}`. TypeScript "passed" only because a generated
`@Route(...)` comment happens to carry the gateway's spelling. All four now
carry the gateway's own spelling in a doc comment next to the method — which is
also what a reader wants when checking the two agree (K23) — but a `yes` on that
page is still not evidence that anything works.

**F10 — secondary SDKs (report only, per the packet).** Dart, Kotlin, Swift and
React-Redux have none of the five endpoints. React-Redux has no Files endpoints
at all (0/33).

## Rejected / moved out

- **Fixing `norbix-js`'s broken generated types** (F4). Two separate breakages
  in a file produced by a script that is not in the repository. It blocks
  `npm run build` and `npm run typecheck` for everybody, so it needs its own
  ticket and a regeneration run, not a patch from a Files slice. → see
  "Needs you".
- **Fixing `downloadFileApi` in TypeScript and Python** (F2). Both now have the
  mechanism; flipping that method over changes its public return type (`Blob` →
  `Uint8Array`, `Any` → `bytes`) in two shipped SDKs. That is a release
  decision. → new ticket.
- **Regenerating types** from `sdks/typegen` or the live gateway — the campaign
  says not to. Every DTO added here is hand-written in the shape the generator
  produces, and says so in a comment.
- **Loosening the TypeScript client so a link-holder can build one.** `new
  Norbix({...})` throws without a `projectId`, so somebody who has nothing but a
  public link cannot construct a client at all — the same is true in Python and
  Go. It is arguably wrong for this endpoint, but it is the client contract for
  every SDK and not a Files decision. One test pins today's behaviour
  (`today a client still cannot be built without a projectId`) so that changing
  it is deliberate. → "Open questions".
- **Editing the generated module files' sibling tests in `norbix-js`**
  (`tests/hub/files.test.ts` and friends). They are regenerated by
  `npm run generate-endpoints`; the new tests live in their own file so a
  regeneration cannot quietly delete them.
- **`docs/codemash-docs`** — slice DOC-2 owns it. The wire facts it needs are in
  "What the documentation repository still needs" below.
- **The stale `EndpointCoverageTests.Hub.*.verified.txt` files in
  `Norbix.Sdk.Tests`** that no test runs (slice SDK's F2), and the five failing
  `Api.*` snapshots (F7). Outside Files.
- **A CLI command for reading a public link.** It is a plain address; `curl` and
  a browser already do it, and a command would only be a worse `curl`.
- **`src/Norbix.Sdk.Types/TaxonomyTreeEndpoints.cs` is compiled by no project**
  — `Compile Remove`d from `Norbix.Sdk.Types` and included nowhere else. Spotted
  while wiring my own files in; not touched.

## Needs you

- [ ] **Merge slice SDK's three open pull requests first** (`norbix-net`,
      `norbix-go`, `norbix-python`, branch `test/files/SDK`). The SDK-2 branches
      in those repositories are stacked on them, so an SDK-2 pull request to
      `main` shows both slices' commits. Merging SDK first makes each SDK-2 pull
      request show only this slice. `cli` and `norbix-js` are already straight
      off `origin/main`.
- [ ] **Open and approve five pull requests** (protected `main`). All branches
      are pushed and rebased:
      ```
      gh pr create -R norbix-code/sdk-ts     --base main --head test/files/SDK-2 --title "test(files): public file links in the TypeScript SDK"
      gh pr create -R norbix-code/sdk-python --base main --head test/files/SDK-2 --title "test(files): public file links in the Python SDK"
      gh pr create -R norbix-code/sdk-go     --base main --head test/files/SDK-2 --title "test(files): public file links in the Go SDK"
      gh pr create -R norbix-code/sdk-net    --base main --head test/files/SDK-2 --title "test(files): public file links in the .NET SDK"
      gh pr create -R norbix-code/cli        --base main --head test/files/SDK-2 --title "feat(files): norbix files publish / unpublish"
      ```
      **Merge order:** the four SDKs, then `cli`.
- [ ] **After `@norbix.ai/ts` is released with the new methods**, bump the CLI's
      dependency and replace the body of `cli/src/lib/publicFiles.ts` with the
      SDK call (F5). The commands and their tests do not change.
- [ ] **Decide who fixes `norbix-js`'s generated types** (F4). Nothing in that
      repository can be built or type-checked until somebody does, and it is not
      a Files problem. It needs the `sync-types` generator back in the
      repository first (K24).
- [ ] **Decide on `downloadFileApi`** in TypeScript and Python (F2) — it cannot
      work today and fixing it changes a public return type.
- [ ] **Re-run the coverage matrix after the merges** and delete the dated note
      at the bottom of `sdks/tests/coverage/modules/files.md`:
      ```
      python3 ~/Projects/norbix/sdks/tests/coverage/build_matrix.py
      ```
      The manifests are already up to date — I ran both gateway emitters on
      `refactoringV2` with PUB merged, and the five endpoints are in
      `endpoints.hub.json` / `endpoints.api.json`.
- [ ] **Go was not installed on this machine.** I installed it with
      `mise use -g go@latest` (go 1.27.1, user-local, under
      `~/.local/share/mise`) so the Go tests could actually run rather than be
      claimed. Remove it with `mise uninstall go` if it is not wanted. Note that
      `go build ./...` fails in `norbix-go` at the branch base too, in
      `references/api.dtos.go` — a generated file full of C# generics that never
      compiled; `go build ./norbix/...` is clean.
- [ ] **Decide the five pre-existing `norbix-net` snapshot failures** (F7) — the
      same list slice SDK handed over, unchanged.

## What the documentation repository still needs (for SLICE DOC-2)

`docs/codemash-docs/sdk/reference/files/` needs five new pages, and the CLI page
needs two commands:

| page | subject |
|---|---|
| `make-file-public` | `POST /{version}/files/item/public` → `IdResponse`, `Id` is the `nbpf_…` public id |
| `make-file-private` | `POST /{version}/files/item/private` → `EmptyResponse`; refused while a folder above is public (`CM-ERRORS-FILES-021`) |
| `make-folder-public` | `POST /{version}/files/folder/public` → `IdResponse`; one record whatever is under it; the root is refused |
| `make-folder-private` | `POST /{version}/files/folder/private` → `EmptyResponse`; takes back per-file links inside too |
| `get-public-file` | `GET /{version}/files/public/{PublicId}/{Name*}` — **no auth, no project id**; bytes, or a 302 to a provider-signed URL; one plain 404 for every miss |

Method names per language, for the reference pages:

| endpoint | .NET | Go | TS | Python |
|---|---|---|---|---|
| make file public | `MakeFilePublicAsync` | `MakeFilePublic` | `makeFilePublic` | `make_file_public` |
| make file private | `MakeFilePrivateAsync` | `MakeFilePrivate` | `makeFilePrivate` | `make_file_private` |
| make folder public | `MakeFolderPublicAsync` | `MakeFolderPublic` | `makeFolderPublic` | `make_folder_public` |
| make folder private | `MakeFolderPrivateAsync` | `MakeFolderPrivate` | `makeFolderPrivate` | `make_folder_private` |
| read a public link | `GetPublicFileAsync` | `GetPublicFile` | `getPublicFile` | `get_public_file` |

`cli/norbix-cli.md` still does not mention `norbix files` at all (slice SDK's
F10), and now needs `publish` / `unpublish` as well. The distinction worth
writing down: **`sign` expires by itself, `publish` does not until somebody
unpublishes it.**

## Open questions

- **Should an SDK client be constructible without a `projectId`?** Today it
  cannot be, in any of the four, so somebody holding nothing but a public link
  cannot use `getPublicFile` — they have to pass a project id that is never
  sent. Changing it touches every SDK's constructor contract, so I pinned the
  current behaviour in a test instead of changing it.
- **Should the four "make it public" endpoints be AI tools?** Slice PUB left
  `[AiTool]` off them deliberately (its "Rejected" list). If they are added on
  the gateway side, nothing changes here — but the documentation would.
- Confirm the two content endpoints (`GET/PUT /files/{id}/content`) stay out of
  the SDKs, as slice SDK argued. They are still the only two Files endpoints in
  no SDK at all.
