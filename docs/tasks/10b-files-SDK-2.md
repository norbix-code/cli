# 10b Files — SLICE SDK-2: the public-files endpoints in the SDKs and the CLI

Campaign [10b-files](../../../../gateway/docs/testing/testing-plan/10b-files/execution-plan.md),
slice **SDK-2**. It follows slice **PUB**, which built public file links in the
gateway and the dashboard, and slice **SDK**, which brought the other 20 Files
endpoints into the four SDKs and the CLI.

## Goal

Slice PUB added five new addresses to the gateway and two new fields to the
file DTOs. Right now no SDK and no CLI command knows they exist. This slice
gives every shipped SDK (.NET, Go, TypeScript, Python) a method for each of
them, a test that runs green, and a documentation page where the repository
has per-module pages; and gives the CLI a `norbix files publish` /
`unpublish` pair.

**Not in scope:** file triggers · Dart, Kotlin, Swift, React-Redux (report
only) · the documentation repository `docs/codemash-docs` (slice DOC-2 owns
it) · regenerating shared types from `sdks/typegen` · any gateway change
(read-only for me).

## Plan

| # | Step | Status |
|---|---|---|
| 0 | Task file, worktrees, base-branch decision | in progress |
| 1 | Gateway (read-only): regenerate the endpoint manifests, rebuild the coverage matrix, confirm the five endpoints show as `no` | todo |
| 2 | .NET — 5 methods, 2 DTO fields, tests | todo |
| 3 | Go — 5 methods, 2 DTO fields, tests | todo |
| 4 | TypeScript — 5 methods, 2 DTO fields, tests, docs page | todo |
| 5 | Python — 5 methods, 2 DTO fields, tests, docs page | todo |
| 6 | CLI — `files publish` / `files unpublish`, tests, README | todo |
| 7 | `sdks/tests/coverage/modules/files.md` updated in place | todo |
| 8 | Report finished; branches pushed; pull requests listed | todo |

## Changes

(filled in per step)

## Rejected / moved out

(filled in as they come up)

## Needs you

(filled in as they come up)

## Open questions

(filled in as they come up)
