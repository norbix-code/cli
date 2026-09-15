# SDK-2 — the five pull requests

Routine A of `gateway/docs/tasks/sdk-management.md`, run on **2026-09-15** for
the branch `test/files/SDK-2`. Five repositories: the four shipped SDKs first,
the CLI last, because the CLI uses `@norbix/js`.

**Nothing was merged.** Domantas merges.

## Goal

The branch `test/files/SDK-2` was finished but had never been offered for
merging. Bring each of the five copies of that branch up to date with its
`main`, prove the tests still pass there, push, and open one pull request per
repository so that one click each is enough.

## The five pull requests

| # | Repository | Pull request | What it carries |
|---|---|---|---|
| 1 | norbix-net | https://github.com/norbix-code/sdk-net/pull/48 | 4 commits · 47 files, +1769 −10 |
| 2 | norbix-go | https://github.com/norbix-code/sdk-go/pull/2 | 3 commits · 5 files, +783 |
| 3 | norbix-js | https://github.com/norbix-code/sdk-ts/pull/37 | 1 commit · 8 files, +748 −4 |
| 4 | norbix-python | https://github.com/norbix-code/sdk-python/pull/2 | 3 commits · 10 files, +873 −2 |
| 5 | cli | https://github.com/norbix-code/cli/pull/1 | 3 commits · 6 files, +796 −2 |

**Merge them in that order.** The CLI one is last because it uses the
TypeScript package; the other four do not depend on each other.

Three of them (.NET, Go, Python) also carry the commits of the earlier slice
`test/files/SDK`, which was never merged on its own in those repositories. That
is not a mistake — those branches were stacked, and after the rebase the older
commits simply travel along inside the same pull request. Only the CLI had its
slice-SDK work merged already (`e192231`).

## Plan (what was done, in order)

1. Fetched all five repositories and checked that the branch existed in each.
   It did, in all five, and no pull request had ever been opened for it.
2. Used the existing worktrees under `~/Projects/norbix/worktrees/sdks/<repo>/test/files/SDK-2`.
   All five were clean and matched their remote. The main checkouts were never
   touched — `norbix-js`'s is on another branch with work in progress.
3. Rebased each worktree on its own `origin/main`.
4. Ran the test command for each repository from the runbook table, plus the
   extra checks it lists.
5. Pushed each branch with `--force-with-lease`, the four SDKs first.
6. Opened the five pull requests, the CLI last.

## Changes

### The rebases

| Repository | Result |
|---|---|
| norbix-net | 4 commits replayed, **3 files conflicted**, resolved — see below |
| norbix-go | 3 commits replayed, clean |
| norbix-js | already on top of `origin/main`, nothing to do |
| norbix-python | 3 commits replayed, clean |
| cli | already on top of `origin/main`, nothing to do |

**The .NET conflict, and how it was resolved.** While this branch was waiting,
`main` added a test project of its own with exactly the same name,
`Norbix.Hub.Tests`. So both sides created the same project, with different
internal identifiers. Three files clashed: `Norbix.Sdk.sln`,
`src/Norbix.Sdk/AssemblyInfo.cs` and
`tests/Norbix.Hub.Tests/Norbix.Hub.Tests.csproj`.

Main's version won for all three. Main's project file is the richer of the two —
it shares `EndpointCoverageDriver.cs` with the other suite, which the branch's
version did not. The three files are now byte-for-byte identical to `main`, so
the pull request does not touch them at all. Everything the branch actually
wrote — the new test files and the new source files — was kept.

### The test runs

All numbers below come from the worktree **after** the rebase.

| Repository | Command | Result |
|---|---|---|
| norbix-net | `dotnet test Norbix.Sdk.sln -p:NuGetAudit=false` | `Norbix.Sdk.Tests` 47 passed / 5 failed · `Norbix.Hub.Tests` **69 passed / 0 failed** |
| norbix-go | `go test ./norbix/...` | all packages ok, 0 failures |
| norbix-go | `go vet ./norbix/...` | clean |
| norbix-go | `gofmt -l ./norbix` | clean |
| norbix-js | `npx vitest run` | **706 passed / 0 failed**, 40 files |
| norbix-js | `npm run lint` | clean |
| norbix-js | `npx prettier --check` (files this branch changes) | clean |
| norbix-python | `uv run pytest` | **595 passed / 0 failed** |
| norbix-python | `make typecheck` (mypy) | no issues, 36 files |
| cli | `npm test` | **42 passed / 0 failed**, 3 files |
| cli | `npx tsc --noEmit` | clean, exit 0 |

**Four of the five are completely green.** The .NET one is not, and the next
section explains why that is still fine.

### The 5 red .NET tests are older than this branch

To be sure the branch was not the cause, the same command was run against a
clean checkout of `origin/main`:

| | this branch | `origin/main` today |
|---|---|---|
| `Norbix.Sdk.Tests` | 47 passed, **5** failed | 31 passed, **6** failed |
| `Norbix.Hub.Tests` | 69 passed, 0 failed | 51 passed, 0 failed |

So `main` is red before anyone touches it. The five that stay red are
`EndpointCoverage.Api.Chat`, `.Database`, `.Echo`, `.Membership` and `.Public` —
exactly the five named in known follow-up **#44** of the runbook (stale
snapshots, red since the DTO regeneration). This branch does not touch any of
them.

The sixth one, `EndpointCoverage.Api.Files`, is red on `main` and **green on
this branch** — the branch fixes it. The branch adds 16 passing tests to one
suite and 18 to the other, and removes one failure. It does not add any.

## Rejected / moved out

- **Fixing the 5 stale .NET snapshots (#44) was not done here.** It would mean
  accepting regenerated snapshot files, and the runbook says to accept only what
  the endpoint manifest confirms — that is a separate job with its own
  verification, and putting it in this pull request would mix it with unrelated
  work. It stays follow-up #44.
- **Fixing the TypeScript generator bug was not done here** (see "Needs you").
  Generated code is regenerated, not edited, so the fix belongs in
  `sdks/typegen`, not in a Files pull request.
- **The broken Go `references/` files were left alone** (see "Needs you").
- Nothing was merged, and no secondary SDK (Dart, Kotlin, Swift, React-Redux)
  was touched.

## Needs you

1. **Merge the five pull requests, in the order of the table above** — "Rebase
   and merge". The CLI one last.

2. **The .NET pull request will show a red build.** Five tests fail, and all
   five already fail on `main` — the table above proves it with a side-by-side
   run. Nothing in this branch causes them. If the build must be green before
   merging, follow-up #44 has to be done first; say the word and it becomes the
   next job.

3. **A generator bug in the TypeScript SDK, found while checking formatting —
   not caused by this branch, and not fixed by it.** The `sync-types.mjs`
   generator writes its `@sdk-dto-patches` block as an `export class` placed
   *inside* another class body, in `src/types/hub2.dtos.ts`. That is not valid
   TypeScript, and a repository-wide `npx prettier --check .` stops there. The
   same broken pattern is in `origin/main`'s copy of the file, so it predates
   this work. It needs a fix in `sdks/typegen` and then a regeneration. Shall I
   open it as a follow-up?

4. **Two generated Go files do not parse at all** — `references/api.dtos.go` and
   `references/hub.dtos.go` still contain C#-style generics (`<...>`), so
   `gofmt` and `go build ./...` both fail on them. They are like that on `main`,
   this branch does not touch them, and they sit outside `./norbix/...`, so
   nothing that ships is affected. Still, they should either be regenerated
   correctly or dropped from the repository. Same question: follow-up?

5. **No public method changed shape.** Nothing in these five pull requests
   renames a method, changes a parameter or changes a return type, so there is
   nothing here that breaks a customer's existing code. Everything is new.

## Open questions

- Items 3 and 4 above are both "generated code is wrong in the repository".
  Should they be one follow-up about the generator, or two separate ones?
- The runbook asks for the trailer `Co-Authored-By: Claude Fable 5.1`, but the
  model that ran this is Opus 5, so the one commit this run created — this
  report — carries `Co-Authored-By: Claude Opus 5` instead. No other commit was
  written; the rebases only replayed commits that already existed. Should the
  runbook say "whichever model ran it" rather than naming one?
- After the merges, Routine B (clean up the worktrees and the branches) and
  Routine C (rebuild the coverage matrix) are still to do. Shall I run them
  automatically once you have merged, or wait to be asked?
