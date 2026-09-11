# 10b Files — SLICE SDK (4 SDKs + the CLI)

## Goal
For every non-trigger Files endpoint, make sure each SDK (.NET, Go, TypeScript,
Python) and the command-line tool (CLI) has **a method, a test that runs green,
and a documentation page** — and fix what is missing.

Not in scope:
- File **triggers** (6 endpoints) — another agent owns them.
- Dart, Kotlin, Swift, React-Redux SDKs — report only, no fixes.
- The docs repository (`docs/codemash-docs`) — SLICE DOC owns it. I only read it
  and report what I find.
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
**12 Hub + 8 API = 20**. See "Open questions".

Excluded on purpose: `GET/PUT /{version}/files/{id}/content` (added by slice V2).
These two are the target of a signed link, like a pre-signed Amazon S3 link. The
caller gets the whole URL back from `GetSignedUrl` / `RequestUploadUrl` and then
fetches it with a plain HTTP call. A typed SDK method would add nothing.
Recorded under "Open questions" for confirmation.

## Plan
1. [done] Survey — build the real endpoint list from gateway code; create one
   worktree per SDK repository; record what exists today.
2. [todo] .NET — fix binary (`byte[]`) download handling in the transport, add
   the missing Files coverage snapshot, add Files-specific tests.
3. [todo] Go — add the missing Files tests (there are none today).
4. [todo] TypeScript — check the existing tests really run green; close gaps.
5. [todo] Python — add the missing `test_files_integration` method + test, add
   the missing API documentation page.
6. [todo] CLI — add a test setup (the repository has none) plus tests for the
   six `files` commands.
7. [todo] Read the SDK reference pages in the docs repository and report gaps
   to SLICE DOC (no edits there).
8. [todo] Update `sdks/tests/coverage/modules/files.md` (outside any repository,
   edited in place) and finish this report.

## Changes
| file | what changed | step |
|------|--------------|------|
| `cli/docs/tasks/10b-files-SDK.md` | created this report | 1 |

## Rejected / moved out
- `docs/codemash-docs/sdk/reference/files/**` — SLICE DOC owns the docs
  repository. I report findings here instead of editing.
- Dart / Kotlin / Swift / React-Redux — report only, per the packet.
- Uncommitted work in the main checkouts (`norbix-js` docs edits, `cli`
  `src/commands/hub.ts` and others) — not mine, untouched. I work only in
  worktrees created from `origin/main`.

## Needs you
- [ ] **Go is not installed on this machine** (`go` not found). I can write the
  Go tests but cannot run them here.

## Open questions
- The slice packet says "13 Hub endpoints"; the code has 12. Which one is the
  thirteenth? I am working with the 12 the code declares.
- `TestFilesIntegration` (`POST /files/integrations/test`): should it be in the
  SDKs? It is already in the TypeScript SDK today. It is missing from .NET, Go
  and Python. I will not add it to the others until this is answered.
- The two new content endpoints (`GET/PUT /files/{id}/content`) — confirm they
  stay out of the SDKs, as argued under "Scope".
