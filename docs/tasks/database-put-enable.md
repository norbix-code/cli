# CLI — module enable / disable use PUT (Database follow-ups, client side)

## Goal

The CLI sends PUT for every module enable / disable, through `@norbix.ai/ts`
4.10.0, matching the gateway change on refactoringV2.

Not in scope: gateway changes, SDK changes (done in sdk-ts PR #75, v4.10.0),
new CLI commands.

## Plan

1. Branch `fix/database-put-enable` from origin/main in a worktree — done
2. Bump `@norbix.ai/ts` to `^4.10.0` (every module enable / disable is PUT there) — done
3. Route tests: push / email / sms module rows assert PUT; scheduler drops its
   version switch; new `tests/module-routes.test.ts` checks all 10
   `norbix module enable|disable <name>` commands send PUT — done
4. Docs: module rows in `docs/{push,email,sms,database}.md` say PUT;
   `db schemas` row says it lists one environment and each row carries `env` — done
5. Ship with `nbx-ship --wait-release --cleanup` — doing

## Changes

| file | what changed | plan step # |
|---|---|---|
| `package.json`, `package-lock.json` | `@norbix.ai/ts` ^4.9.1 → ^4.10.0 | 2 |
| `tests/module-routes.test.ts` | new: 20 rows, every module enable / disable → PUT | 3 |
| `tests/push-routes.test.ts`, `tests/email-routes.test.ts`, `tests/sms-routes.test.ts` | module enable / disable rows GET → PUT | 3 |
| `tests/scheduler-routes.test.ts` | removed the "GET before 4.6" switch; PUT only | 3 |
| `docs/push.md`, `docs/email.md`, `docs/sms.md`, `docs/database.md` | verbs GET → PUT; schema list is per environment | 4 |

## Findings

- No CLI source change was needed: every enable / disable command calls the SDK
  method, so the verb follows the installed SDK. Left as is.
- `db schemas` prints the raw response, so the new `env` field shows up with no
  code change. The paging cursor (`--after`) is now a schema id (`sch_…`); a
  cursor saved before the gateway deploy no longer matches. Documented only.
- `npm run lint` does not exist in this repo (only `npm test` and `tsc`). Left open.

## Rejected / moved out

- `docs/tasks/agent-native-cli.md` in the main checkout is untracked and not
  mine — untouched.

## Needs you

- Nothing.

## Open questions

- None.
