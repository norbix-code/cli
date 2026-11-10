# Owner round 2026-11-05 — agent files checklist and db schema help (cli)

Branch `docs/owner-round-ai` from `origin/main` (c6ec641). Siblings: gateway, docs (same branch name).

## Goal

`norbix ai init` teaches the build checklist (items 73 + 78) and `norbix db schema --help` shows the full
change cycle, the accepted id forms and the layout guide (Finlo question 4).

Not in scope: a release, `cli/reference/**` in the docs repo.

## Plan

1. done — `db schema --help`: sch_ id only; what it returns; collectionId accepts sch_ id / name / unique
   title and is stored as the name (CM-ERRORS-SCHEMA-028); read → draft → preview → publish → read back;
   links to the schema guide (`#ui-schema`) and field types. Examples use a real `sch_` id.
2. done — `agent-files.ts`: `buildChecklist()` (8 items + MJML and schema examples) in the Claude skill;
   the short block (CLAUDE.md / AGENTS.md / Cursor) points at the checklist in `.norbix-ai/context.md`
   (the Hub sends it; gateway `NorbixBuildContract.Checklist`). `AGENT_FILES_VERSION` 2 → 3.
3. done — `tests/ai-init.test.ts`: version line from the constant; skill budget 75 → 105 lines with
   assertions on the checklist; block bullet points at the checklist.
4. done — This task file.

## Changes

| file | what changed | step |
| --- | --- | --- |
| `src/commands/db/schema.ts` | description, examples, arg description | 1 |
| `src/lib/agent-files.ts` | `buildChecklist()`, pointer bullet, version 3 | 2 |
| `tests/ai-init.test.ts` | budget, checklist assertions | 3 |

Tests: `npm test` (build + vitest) — 63 files, 1482 tests passed.

## Findings

- F1 — Other `db schema *` subcommands (draft, update, publish, diff, discard, versions) still show 24-hex ids in their examples; the Hub refuses them (`Expected prefix: sch`). Left open.
- F2 — `code runs --limit` allows 1–50, the Hub keeps 20 runs per trigger / task.
- F3 — The owner's "source membership" user picker is `"source":"user"` on the wire; the checklist uses that.

## Rejected / moved out

- The full checklist in the short block — it breaks the block's 34-line budget; the block points at the context file instead.

## Needs you

- [ ] Release the CLI (then the docs `cli/reference/**` regenerate; `ai init --update` rewrites version-2 files).

## Open questions

None blocking.
