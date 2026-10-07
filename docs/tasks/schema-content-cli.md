# schema-content — CLI side

## Goal

Give `norbix` the three terminal-side pieces of the gateway schema-content
campaign (gateway branch `audit/schema-content`, not yet on `refactoringV2`):
`db find --expand` / `db get --expand` (expanded references), `db update
--array-filters` (MongoDB array filters on `updateOne` / `updateMany`) and
`files get-by-id` (a file by its stable id).

Not in scope: new schema field DTOs (`ObjectFieldDto`, `ArrayFieldDto`,
`JsonFieldDto`, `CurrencyDefaultDto`) and the new field options — the CLI
sends schema files as JSON and never types them; `Slug`, `Unique`,
`DisplayField` etc. are gateway validation, nothing to add here. Hub-side
`norbix hub database …` / `norbix hub files …` reach the new fields and the
new Hub route through the regenerated `request-fields.json`, no command needed.

## Plan

1. `done` — regenerate `src/generated/request-fields.json` from the
   `@norbix.ai/ts` build of branch `audit/schema-content` (norbix-js worktree
   `/Users/djovaisas/Projects/norbix/worktrees/norbix-js/audit/schema-content`,
   commit `b7f7f4e`), copied over `node_modules/@norbix.ai/ts` for the run.
   Diff by method: `api.files.getFileById` and `hub.files.getFileById` new;
   `expandReferences` on `api.database.find / findOne / findOwn` and
   `hub.database.findRecords / findOneRecord`; `arrayFilters` on
   `api.database.updateOne / updateMany` and `hub.database.updateOneRecord /
   updateManyRecords`. Nothing removed, no path changed.
2. `done` — `db find --expand` and `db get --expand` send `expandReferences: true`.
3. `done` — `db update --array-filters <json-array>` sends `arrayFilters` with
   `--id`, `--many` and `--all`; a value that is not a JSON array is refused
   before anything is sent.
4. `done` — `files get-by-id <id>` calls `GET /files/{integration}/by-id/{id}`.
5. `done` (committed with steps 2–4) — tests: `tests/db-routes.test.ts` (route rows + the query / body the
   new flags send + the refusals), `test/files.test.ts` (`get-by-id`).
6. `done` — docs: `docs/database.md`, README file-command table.
7. `done` — `nbx-ship --no-merge`: pull request open, NOT merged (the SDK with
   this contract is not released; see Needs you).

## Changes

| file | what changed | step |
|---|---|---|
| `src/generated/request-fields.json` | regenerated (see step 1 for the exact diff) | 1 |
| `src/commands/db/find.ts`, `src/commands/db/get.ts` | `--expand` flag → `expandReferences: true` | 2 |
| `src/commands/db/update.ts` | `--array-filters` flag → `arrayFilters` on every shape | 3 |
| `src/lib/records.ts` | `requireJsonArray` — `--array-filters` must be a JSON array | 3 |
| `src/commands/files/get-by-id.ts` | new command | 4 |
| `tests/db-routes.test.ts` | rows for `find --expand`, `get --expand`, `update … --array-filters`; query / body checks; refusal | 5 |
| `test/files.test.ts` | `files get-by-id` reaches `/by-id/{id}` | 5 |
| `tests/__snapshots__/schema.test.ts.snap` | the command schema snapshot gains the new flags and command | 5 |
| `docs/database.md`, `README.md` | the new flags and command, the error codes they can meet | 6 |
| `docs/tasks/schema-content-cli.md` | this file | — |

## Findings

- `src/generated/request-fields.json` carries the label `@norbix.ai/ts@4.11.0`
  (the version npm installed) although its content comes from the
  `audit/schema-content` build of the SDK. Running `npm run gen:fields` against
  the released 4.11.0 would drop the new fields again. Regenerate once the SDK
  with this contract is on npm (the `sdk` label then becomes that version).
  Left open on purpose — see Needs you.
- `src/commands/db/update.ts` refuses `$`-operators at the top level of
  `--update`; a nested path key such as `"lines.$[line].qty"` passes, which is
  what the gateway wants. No change.
- The SDK worktree's `package.json` says `version: 1.2.0` while npm serves
  4.11.0 — semantic-release writes the real number at publish time; nothing to
  fix in the CLI.

## Rejected / moved out

- `db find-own` (API `findOwn`, also takes `expandReferences`): there is no
  such command today and the task did not ask for one; `norbix api database
  find-own --expand-references` reaches it through the generated dispatcher.

## Needs you

- [ ] Merge order: this pull request depends on a released `@norbix.ai/ts`
      that carries `expandReferences`, `arrayFilters` and `getFileById`
      (norbix-js branch `audit/schema-content`). Merge the gateway campaign,
      release the SDK, bump `@norbix.ai/ts` in `package.json`, run `npm run
      gen:fields`, commit the label change, then merge this pull request.
      Until then `npm test` on a clean install fails on the three new
      `files get-by-id` tests (`client.api.files.getFileById is not a
      function`) and typecheck on the new flags.

## Open questions

None.
