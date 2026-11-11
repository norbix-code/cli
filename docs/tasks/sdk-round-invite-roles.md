# SDK round — invite roles and password-reset settings, CLI `users invite --role`
This file: /Users/djovaisas/Projects/norbix/worktrees/cli/feat/users-invite-role/docs/tasks/sdk-round-invite-roles.md (branch feat/users-invite-role; after merge: /Users/djovaisas/Projects/norbix/sdks/cli/docs/tasks/sdk-round-invite-roles.md on main)

## Goal
Regenerate the SDK types from gateway `refactoringV2` (420b1bd0a) by gateway docs/tasks/sdk-management.md, and let `norbix users invite` give the invited user roles with `--role`.
Not in scope: the gateway code (shipped by its own tasks: docs/tasks/invite-role-env-templates.md, docs/tasks/password-reset-settings.md); new SDK methods; Python and Swift (no generated types by design); the Maven Central publish limit.

## Plan
1. [done] gen(sdks:types): types regenerated from a private stack of gateway refactoringV2 420b1bd0a — Api `InviteUserRequest.roles`; Hub `UpdateAuthorizationSettings.allowResetPassword`, `resetPasswordEmailTemplate`, `resetPasswordTokenExpiration`, `resetPasswordCallback`. Additions only (Go: column realignment of the two structs)
2. [done] release(sdks): shipped with nbx-ship — sdk-ts #134 → v4.55.0, sdk-go #79 → v2.59.0, sdk-net #134 → v3.50.0, sdk-dart #62 → v2.37.0, sdk-kotlin #66 merged and tagged v1.38.0 but NOT on Maven Central (monthly release limit, see Needs you)
3. [done] feat(cli:users:invite): `--role` (repeatable or a comma list), sent as `roles`; help text names the default role, who may give which role and CM-ERRORS-MEMBERSHIP-001; tests `tests/users-invite.test.ts` (4) and the dry-run body in `tests/agent-mode.test.ts`; schema snapshot gains `role:string`
4. [done] release(cli): `@norbix.ai/ts` ^4.53.0 → ^4.55.0; build, tsc and 1538 tests green; shipped with nbx-ship (see the PR in the report)
5. [doing] gen(mcp:manifest): manifest types from @norbix.ai/ts 4.55.0

## Changes
| file (absolute, branch) | what changed | step |
|------|--------------|------|
| /Users/djovaisas/Projects/norbix/sdks/norbix-js/src/types/api2.dtos.ts, hub2.dtos.ts (main) | regenerated | 1 |
| /Users/djovaisas/Projects/norbix/sdks/norbix-go/norbix/api/dtos/dtos.go, norbix/hub/dtos/dtos.go (main) | regenerated | 1 |
| /Users/djovaisas/Projects/norbix/sdks/norbix-net/src/Norbix.Sdk.Types/Generated/Api.dtos.cs, Hub.dtos.cs + two EndpointCoverage `.verified.txt` (main) | regenerated; the coverage snapshots now show the new fields | 1 |
| /Users/djovaisas/Projects/norbix/sdks/norbix-dart/references/api.dtos.dart, hub.dtos.dart (main) | regenerated (`x dart` update mode) | 1 |
| /Users/djovaisas/Projects/norbix/sdks/norbix-kotlin/references/api.dtos.kt, hub.dtos.kt (main) | regenerated (`x kotlin` update mode) | 1 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/users-invite-role/src/commands/users/invite.ts | `--role` flag, `inviteRoles()` | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/users-invite-role/tests/users-invite.test.ts | new | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/users-invite-role/tests/agent-mode.test.ts | dry-run case: the `roles` body | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/users-invite-role/tests/__snapshots__/schema.test.ts.snap | `role:string` on `users invite` | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/users-invite-role/package.json, package-lock.json | `@norbix.ai/ts` raised to the new release | 4 |

## Findings
- checked(sdks): tests after regeneration — sdk-ts tsc + vitest 1293 passed + prettier; sdk-go vet + test green, gofmt clean; sdk-net 109 + 295 + 2 passed (after accepting the two coverage snapshots); sdk-dart analyze clean, 522 tests passed; sdk-kotlin not run (no JDK 17 on this Mac; only `references/` changed, which the build does not compile).
- decision(sdk-ts:endpoints): the endpoint modules were not regenerated — `InviteUserRequest` is already sent whole by `membership.inviteUser`, so the new field needs no module change.
- decision(cli:users:invite): the comma list is split and trimmed; empty pieces are dropped; no `--role` sends no `roles` at all (not an empty list), so the gateway default applies.
- not verified: a real invite against a gateway (CLI tests use a fake `fetch`); the new Hub reset-password settings have no CLI command (dashboard settings — Routine D rule 3).

## Rejected / moved out
- none

## Needs you
- [ ] blocked(sdk-kotlin:release): v1.37.0 and v1.38.0 are tagged but not on Maven Central — "monthly release count limit … Usage resets 2026-12-01" · action: re-run release run 43039269323 in norbix-code/sdk-kotlin after 2026-12-01 (it publishes the latest main), or raise the Sonatype plan

## Open questions
- none
