# TYPES-REGEN — regenerate every SDK's types from the gateway (issue #68)

Campaign: Norbix Files testing, slice **TYPES-REGEN**.

## Goal

Every SDK data type (a "DTO" — the plain object that carries a request or a
response over the wire) is **generated from the running gateway**, never typed
by hand. Delete the hand-written copies that slices SDK-2 and API-TEST added
while the types were frozen, run each repo's own regeneration, and prove the
existing tests still pass — that is what shows the generated types have the
same shape as the hand-written ones.

**Not in scope:** new SDK methods, new endpoints, file triggers, anything in
the gateway itself (read-only here), fixing the `sdks/typegen` rewrite (that is
its own task, `sdk-type-generation.md`).

## Plan

| # | Step | Status |
|---|---|---|
| 1 | Run the gateway locally (Community.Hub :5001, Community.Api :5002) from `refactoringV2` | done |
| 2 | Create one worktree per repo on branch `chore/types-regen` | done |
| 3 | Find each repo's real regeneration entry point; record the ones that have none | done |
| 4 | norbix-js — regenerate, build, test | **done** — 739 tests green |
| 5 | norbix-net — delete 5 hand-written files, regenerate, build, test | **done** — 144 tests green |
| 6 | norbix-go — delete hand-written probe DTOs, regenerate, build, test | todo |
| 7 | norbix-python — regenerate, build, test | todo |
| 8 | norbix-swift — `make sync-types`, build, test | todo |
| 9 | norbix-dart — `make gen`, build, test | todo |
| 10 | norbix-kotlin — regenerate, build, test | todo |
| 11 | norbix-react-redux — check whether it holds types at all | todo |
| 12 | Diff review per repo: which types appeared / changed / disappeared | todo |
| 13 | Routine A (push + pull request per repo), Routine C (coverage matrix) | todo |

## Status table

Filled in as the work lands. One row per repo × dimension.

## Changes

## Rejected / moved out

## Needs you

## Open questions
