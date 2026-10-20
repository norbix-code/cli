# Environment promotion — phase 2 (CLI): `norbix env promote / rollback / built-ins repair`
This file: /Users/djovaisas/Projects/norbix/worktrees/cli/feat/promotion-phase2/docs/tasks/promotion-phase2.md (branch feat/promotion-phase2)
Gateway side (shipped 57b5f4bad): /Users/djovaisas/Projects/norbix/gateway/docs/tasks/promotion-phase2.md (branch refactoringV2)
Phase 1 contract: /Users/djovaisas/Projects/norbix/gateway/docs/tasks/promotion-v2.md (branch refactoringV2)

## Goal
Give developers and agents first-class promotion commands with a readable preview (dry run by default), a hint when
they change content directly in a higher environment, and `norbix ai init` guidance that says "build in TEST, preview,
promote, roll back if needed — never build PROD by hand".

Not in scope: team-member update / remove commands (another agent; may come in a later message); regenerating
`@norbix.ai/ts` (see decision below); the dashboard.

## Plan
1. [done] docs(cli:env:promotion): this task file
2. [todo] feat(cli:env:promotion): `norbix env promote --from TEST --to PROD` — preview by default (`--dry-run` says it explicitly), real run with `--yes`; `--confirm-record-loss`; `--seed / --skip / --map id=targetId`; human preview (summary, items by status, integrations with choices and warnings, not-promoted list); `--json` prints the raw answer; record-loss refusal explained with the plan
3. [todo] feat(cli:env:promotion): `norbix env rollback --to PROD --version N` and `norbix env built-ins repair` (same preview / `--yes` rule)
4. [todo] feat(cli:env:promotion-hint): a content write (schema, taxonomy, term, template, trigger, footer, signature) into an env that has a lower one prints on stderr: "PROD is promoted from TEST — make the change in TEST and run `norbix env promote --from TEST --to PROD`"; the env ladder (`promotionOrder`) is cached with the env list
5. [todo] feat(cli:ai:init): the skill and the CLAUDE.md / AGENTS.md block get a short "Environments" section
6. [todo] test(cli): tests for the three commands (fixture = the phase 1 contract example), the hint, `ai init`, the old `hub … promote --body` path; build + full test suite green
7. [todo] docs(cli): README + docs/project.md command table
8. [todo] release(cli): pull request, merge with nbx-ship; semantic-release publishes a minor from CI

## Decisions
- decision(cli:sdk-types): the CLI does not wait for a regenerated `@norbix.ai/ts`. 4.29.0 knows `promoteEnvironment` / `rollbackPromotion` but not `confirmRecordLoss`, `integrationChoices`, rollback `dryRun`, the v2 result fields, or the built-in repair endpoint. Regenerating needs a running Hub (`sync-types.mjs`) and a separate SDK release; the transport sends the whole request object, so the CLI builds the body with its own types (`src/lib/promotion.ts`) and calls the repair route through the SDK transport of the environments module (same auth, refresh, env rule, retry). Recorded under Findings for the SDK owners.
- decision(cli:env:dry-run): for these three commands `--dry-run` is the server's preview (the request is sent with `dryRun: true`, nothing changes) — not the usual "send nothing". It is also the default. A real run needs `--yes`. This is what an agent taught "dry run first" needs: the plan, not the HTTP request.
- decision(cli:env:ladder): which env feeds which comes from `promotionOrder` in the env list (gateway 57b5f4bad); it is cached with the env names (5 minutes). An older gateway sends no ladder: then PROD's lower env is TEST if the project has one, else the only other env; other envs get no hint.
- decision(cli:env:hint): an allowlist of command ids, printed on stderr only (stdout stays one JSON document), also on a `--dry-run` (that is when an agent should read it). Record commands never hint: records are not promoted.

## Changes
| file (absolute, branch feat/promotion-phase2) | what changed | step |
|------|--------------|------|
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/promotion-phase2/docs/tasks/promotion-phase2.md | this file | 1 |

## Findings

## Rejected / moved out

## Needs you

## Open questions
- none
