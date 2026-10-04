# SDK follow-up — notifications alignment
This file: /Users/djovaisas/Projects/norbix/worktrees/cli/docs/notifications-alignment-sdks/docs/tasks/notifications-alignment-sdks.md (branch docs/notifications-alignment-sdks)

## Goal
Bring the SDKs in line with the gateway notifications alignment (gateway `refactoringV2` `0fcf8f1d2`; rules in gateway `docs/architecture/Notifications.Campaigns.md`, task in gateway `docs/tasks/notifications-alignment.md` step 26).
Not in scope: secondary SDKs (Dart, Kotlin, Swift, React-Redux, MCP — report only per the runbook); new CLI commands.

What changed on the server:
- Email / Push / SMS campaign create **requires** the provider `integrationId` (Email / Push: `campaign.integrationId`; SMS: new top-level `integrationId`).
- Email / Push / SMS trigger actions **require** `integrationId`; new optional `language`, `initiatorId`.
- New: `GET /{version}/triggers/attention`, `POST /{version}/account/projects/{projectId}/settings/languages/check`.
- Push / SMS template list rows carry `languages`.

## Plan
1. [done] feat(sdk-go:notifications): regenerated hub DTOs; `Hub.Account.CheckProjectLanguages`, new `Hub.Triggers.GetTriggersNeedingAttention`; 375 tests — merged https://github.com/norbix-code/sdk-go/pull/22
2. [done] feat(sdk-net:notifications): regenerated DTOs (typegen csharp); `client.Account.CheckProjectLanguagesAsync`, `client.Triggers.GetTriggersNeedingAttentionAsync` (source-generated); trigger-action body tests; 61 + 200 tests — merged https://github.com/norbix-code/sdk-net/pull/72
3. [done] feat(sdk-python:notifications): hand-written (generator script not in the repo, marked HAND-WRITTEN) `hub.triggers.get_triggers_needing_attention`, `hub.account.check_project_languages`, sync + async; 827 tests — merged https://github.com/norbix-code/sdk-python/pull/27
4. [blocked] feat(sdk-ts:notifications): regenerated types (Hub 1380 → 1386, Api 213 → 216 classes), `hub.triggers.getTriggersNeedingAttention`, `hub.account.checkProjectLanguages`; 834 tests, lint / build green — https://github.com/norbix-code/sdk-ts/pull/70 open: the "Security scan" check fails on old dev dependencies in package-lock.json (the same failure is on main since 2026-10-04 08:32); the branch rules block the merge
5. [done] decision(cli): no code change — the CLI has no create-campaign or save-trigger commands *(corrected 2026-10-04: `email|push|sms campaign create` do exist — aligned on branch `fix/campaign-create-alignment`: `--integration` required, `--initiator` added; there is still no save-trigger command)*; the generic `norbix hub …` command passes a flat SMS `--integrationId`, but cannot pass the nested `campaign.integrationId` for Email / Push (existing limitation)

## Changes
| repo | branch → base | what | step |
|------|---------------|------|------|
| norbix-code/sdk-go | feat/notifications-alignment → main | dtos.go regenerated, account.go, new triggers.go + namespace wiring, tests, README / docs | 1 |
| norbix-code/sdk-net | feat/notifications-alignment → main | Hub.dtos.cs regenerated, body-variant + trigger-action tests, coverage snapshots, docs | 2 |
| norbix-code/sdk-python | feat/notifications-alignment → main | account.py, new triggers.py, tests, docs, references/hub_dtos.py | 3 |
| norbix-code/sdk-ts | feat/notifications-alignment → main (PR #70, open) | hub2 / api2 types, hub.triggers module, checkProjectLanguages, tests, README | 4 |

## Findings
- fix(sdk-ts:tooling): the gitignored local `generate-endpoints.mjs` is older than main — its output would delete hand-written code (scheduler input types, binary downloads, unsubscribe `optional` scope); only the two new routes were taken. ~15 other merged gateway endpoints (AI plans, AI triggers, schema embed, public brand asset) are still missing from sdk-ts — left open
- fix(sdk-ts:tooling): `sync-types.mjs` puts the `@sdk-dto-patches` block outside the module since the generator writes `{` on its own line — left open
- chore(gateway:contracts): `integrationId` stays optional in the generated types (Email / Push campaign, trigger action) although the server requires it — needs `[ApiMember(IsRequired = true)]` on the gateway DTOs — left open
- chore(sdk-go): the "gen" commit type is not a release type; a `gen(…)` only commit would not publish — the feat commit released this one
- chore(sdk-python): no AI-trigger save method in the Python SDK — left open
- chore(sdk-ts:ci): "Security scan" (OSV) fails on dev dependencies brace-expansion, braces, http-cache-semantics, ip-address, undici (5 High, 6 Medium, 1 Low; braces and http-cache-semantics have no fixed version) — fails on main too

## Rejected / moved out
- decision(sdks): secondary SDKs (Dart, Kotlin, Swift, React-Redux, MCP) not changed — runbook: report only

## Needs you
- [ ] blocked(sdk-ts:ci): PR #70 cannot merge — the "Security scan" check fails on old dev dependencies (not from this change; main fails the same way) and the branch rules require green checks — needs you · action: choose one: (a) "merge with admin" — I merge #70 with `--admin` now and fix the dev dependencies in a separate PR; (b) "fix deps first" — I open a `chore(deps)` PR that updates the fixable dev dependencies and adds the two unfixable advisories (braces, http-cache-semantics, dev-only) to the OSV ignore list, then merge #70; recommended: (b), it keeps the rule meaningful and the ignore list is reviewable

## Open questions
- none
