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
2. [done] feat(cli:env:promotion): `norbix env promote --from TEST --to PROD` — preview by default (`--dry-run` says it explicitly), real run with `--yes`; `--confirm-record-loss`; `--seed / --skip / --map id=targetId`; human preview (summary, items by status, integrations with choices and warnings, not-promoted list); `--json` prints the raw answer; record-loss refusal explained with the plan
3. [done] feat(cli:env:promotion): `norbix env rollback --to PROD --version N` and `norbix env built-ins repair` (same preview / `--yes` rule)
4. [done] feat(cli:env:promotion-hint): a content write (schema, taxonomy, term, template, trigger, footer, signature) into an env that has a lower one prints on stderr: "PROD is promoted from TEST — make the change in TEST and run `norbix env promote --from TEST --to PROD`"; the env ladder (`promotionOrder`) is cached with the env list
5. [done] feat(cli:ai:init): the skill and the CLAUDE.md / AGENTS.md block get a short "Environments" section
6. [done] test(cli): tests for the three commands (fixture = the phase 1 contract example), the hint, `ai init`, the old `hub account environment promote --body` path; `tsc --noEmit` clean, `npm test` 39 files, 1067/1067 passed
7. [done] docs(cli): README + docs/project.md command table
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
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/promotion-phase2/src/lib/promotion.ts:277 | new: v2 types, `--seed/--skip/--map` parsing, the human preview, repair rendering, the hint allowlist (`:360`), `lowerEnvOf` (`:386`) | 2, 3, 4 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/promotion-phase2/src/commands/env/promote.ts | new command | 2 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/promotion-phase2/package.json | `env` topic text, `env built-ins` subtopic | 2 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/promotion-phase2/src/commands/env/rollback.ts | new command | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/promotion-phase2/src/commands/env/built-ins/repair.ts | new command (repair route through the SDK transport) | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/promotion-phase2/src/base.ts:696, :709, :839 | hint decided with the env rule, printed once on stderr after a successful call or a `--dry-run` report | 4 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/promotion-phase2/src/lib/hosts.ts:466 | env cache keeps `promotionOrder`; `cachedPromotionOrder` | 4 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/promotion-phase2/src/lib/env-rule.ts | `promotionOrderOf` | 4 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/promotion-phase2/src/lib/agent-files.ts:68 | "Environments" bullet in the block, "Environments — build in TEST, promote to PROD" section and an example in the skill | 5 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/promotion-phase2/tests/ai-init.test.ts | block bullets (+1), line limits 12→13 (block) and 40→50 (skill), a new test for the Environments guidance | 5 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/promotion-phase2/tests/env-promote.test.ts (+ `__snapshots__/env-promote.test.ts.snap`) | new: 14 tests | 6 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/promotion-phase2/tests/__snapshots__/schema.test.ts.snap | three new commands in `norbix schema` | 6 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/promotion-phase2/README.md, docs/AGENTS.md, docs/agent-contract.md | "Moving TEST to PROD"; preview-by-default commands in the contract | 7 |

## Findings
- gen(sdk-ts:types): `@norbix.ai/ts` 4.29.0 lags the gateway: no `confirmRecordLoss` / `integrationChoices` on `PromoteEnvironmentRequest`, no `dryRun` / `confirmRecordLoss` on `RollbackPromotionRequest`, only the old fields on `PromotionResultDto`, no built-in repair method, no `promotionOrder` on `ProjectEnvironmentsDto`. The CLI works around it with local types — open (next types regen of the SDKs)
```ts
// node_modules/@norbix.ai/ts/dist/types/hub2.dtos.d.ts:8026-8033 (4.29.0)
    class PromoteEnvironmentRequest extends CodeMashRequestBase implements IReturn<PromoteEnvironmentResponse> {
        sourceEnv: string;
        targetEnv: string;
        dryRun: boolean;                      // <-- missing: confirmRecordLoss, integrationChoices
```
```ts
// src/commands/env/promote.ts (branch feat/promotion-phase2) — the cast the CLI needs until then
        return (await client.hub.account.promoteEnvironment(body(dryRun) as never)) as unknown as {item?: PromotionResult}
```
- gap(cli:hint): `norbix hub <module> <method>` (the generic path) and `norbix raw` never print the promotion hint — only the named content commands do — open
- gap(cli:hint): there is no `db taxonomy create` command in the CLI (taxonomies are made with `norbix hub database save-database-taxonomy`), so a taxonomy write gets no hint from the CLI; terms do (`db term create/update`) — open
- chore(cli:git): `nbx-doctor` WARN — the main checkout /Users/djovaisas/Projects/norbix/sdks/cli is on `fix/sdk-1.3-and-deps` with an untracked `docs/tasks/agent-native-cli.md`; not mine, untouched

## Acceptance #5 — "set up PROD like TEST" leads to a promotion with a preview first
- In a fresh folder `/tmp/happy-tummy-accept.yRfs` (scratch, outside every repo): `norbix ai init` (this branch's build) wrote `.claude/skills/norbix/SKILL.md` and `CLAUDE.md`. Both carry the Environments rules (`grep -n promot` → CLAUDE.md:11, SKILL.md:3, 23, 25, 28, 29, 30, 32, 45). Log: `~/scratch/promotion-phase2/accept-ai-init.txt`, `accept-grep.txt`.
- A headless agent in that folder (`claude -p "… Set up PROD like TEST. Do not run any command now — list the exact commands …" --strict-mcp-config --setting-sources project,local --disallowedTools "Bash Edit Write WebFetch WebSearch"`) answered, in order: `norbix whoami --json` → `norbix env promote --help` → **`norbix env promote --from TEST --to PROD --json` (preview)**, show summary / items with recordCount / integrations with realSender / notPromoted, ask about each integration and record loss → **`norbix env promote --from TEST --to PROD --yes --json [--seed …] [--map …] [--confirm-record-loss]` only after you agree**, keep `fromVersion` → rollback `norbix env rollback --to PROD --version <fromVersion>` (preview, then `--yes`); "I never edit PROD directly". Full answer: `~/scratch/promotion-phase2/accept-agent.txt`.
- MCP side (gateway 57b5f4bad): `promote_environment` says "USE IT whenever the user wants PROD … to match TEST … ALWAYS two calls: (1) dryRun: true …; (2) only after the user agreed … dryRun: false"; a `dryRun: true` call needs no confirmation and no env argument (L3 test `Promote_Is_An_Environment_Tool_Whose_Dry_Run_Is_A_Preview`); the Norbix assistant prompt routes "set up PROD like TEST" to a promotion (prompt v5).

## Rejected / moved out
- decision(cli:sdk-types): regenerate `@norbix.ai/ts` first and wait for its release — rejected for this change: it needs a running Hub and a separate SDK release; the CLI's local types cover the gap — new ticket: none (listed under Findings for the next regen)

## Needs you

## Open questions
- none
