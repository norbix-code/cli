# Database last wave — CLI follows the gateway contract changes

## Goal

The CLI (`norbix db …`) follows the last Database wave on gateway
`refactoringV2`, using `@norbix.ai/ts` 4.11.0.

Not in scope: new commands for dashboard-only routes (schema rename,
`POST /aggregates/test`, taxonomy structure) — they stay in "No command on
purpose" and are reachable with `norbix hub database …`.

## Plan

1. chore(deps): `@norbix.ai/ts` ^4.11.0, regenerate `src/generated/request-fields.json` — done
2. feat(database): `db update` / `db delete` get `--all` (sends `allRecords: true`, always asks unless `--yes`); `--many --filter '{}'` is refused before sending and points at `--all`; `--update` takes plain fields, `$` operators refused before sending — done
3. test(database): route and body tests for `--all`, empty filter, operators; agent-mode list of destructive commands; schema snapshot — done
4. docs(database): record write rules, `--all`, triggers per environment, taxonomy `dependencyRefs` and new error codes, schema delete blocked by a saved aggregate; `$set` removed from AGENTS examples — done
5. ship with nbx-ship (PR, checks, rebase merge, release) — doing

## Changes

| file | what changed | plan step # |
|---|---|---|
| `package.json`, `package-lock.json` | `@norbix.ai/ts` ^4.11.0 | 1 |
| `src/generated/request-fields.json` | regenerated: `allRecords` on api `updateMany`/`deleteMany` and hub `updateManyRecords`/`deleteManyRecords`; `renameUniqueName` gone from `renameDatabaseSchema` | 1 |
| `src/lib/records.ts` | new: `refuseEmptyFilter`, `refuseUpdateOperators` | 2 |
| `src/commands/db/update.ts` | `--all`, plain-fields `--update`, empty-filter guard, new examples | 2 |
| `src/commands/db/delete.ts` | `--all`, empty-filter guard | 2 |
| `src/lib/agent-files.ts`, `docs/AGENTS.md` | example update without `$set` | 2, 4 |
| `tests/db-routes.test.ts` | `--all` rows and body tests, refusals | 3 |
| `tests/agent-mode.test.ts` | `--all` variants in the destructive list; non-empty filters | 3 |
| `tests/__snapshots__/schema.test.ts.snap` | new `all:boolean` flag on `db update` / `db delete` | 3 |
| `docs/database.md` | see step 4 | 4 |

## Findings

- `db update` examples and AGENTS.md used `{"$set":…}`; with the gateway change they would fail with `CM-ERRORS-DATABASE-035`. Fixed here.
- `JoinedCollections` on `MongoDbAggregateDto` (follow-up aggregates) has no CLI command: saved aggregates are edited in the dashboard. Left open, no change needed.

## Rejected / moved out

- `docs/tasks/agent-native-cli.md` (untracked in the main checkout) — not mine, untouched.

## Needs you

- Nothing.

## Open questions

- None.
