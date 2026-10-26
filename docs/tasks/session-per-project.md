# Sessions per project — a sign-in for project B no longer ends the sign-in for project A
This file: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/session-per-project/docs/tasks/session-per-project.md (branch fix/session-per-project)

## Goal
Two `norbix login`s for two projects on the same Hub keep two sign-ins, and every command, `logout` and `whoami` pick the sign-in of the project they are for.
Not in scope: a new Hub contract (the device sign-in is unchanged); the 1.18 `~/.norbix/session.json` migration (already shipped, untouched); publishing the release (merge to `main` publishes by itself — the owner merges).

## Plan
1. [done] decision(cli:auth:sessions): key a sign-in by Hub AND project — `sessions/<hub>@<project>.json`; `sessions/<hub>.json` stays the slot of a sign-in made with no project (and the file 1.47.1 wrote, read as a fallback, never deleted or moved)
2. [done] feat(cli:auth:sessions): `profiles.ts` — slot key, `findSession` (asked project → its slot, else the Hub slot when it is for no project or the same project), `listSessions` with the project of every file; pending codes keyed the same way
3. [done] fix(cli:auth:context): `resolveContext` asks for the project from flags / profile / old config first, picks the session for it, and only then fills a missing project from the session — the loop that made a stale session leak its project is gone; `ctx.sessionKey`, `ctx.requestedProjectId`
4. [done] fix(cli:login): the sign-in is started for `--project` / the profile's `project_id` only, never for the project of an older sign-in; the profile and project are printed before the browser opens; the session is saved under the project the Hub pinned it to
5. [done] feat(cli:logout): `norbix logout` removes the sign-in of the active profile / host / project only; `--all` removes every sign-in (the old no-flag behaviour)
6. [done] feat(cli:profiles,whoami): `profiles` lists every sign-in with its Hub, project and file; `whoami` names the file in use
7. [done] test(cli:auth:sessions): two logins coexist; logout one keeps the other; `--all`; the 1.47.1 file is used for its project and not for another; `--project` beats the profile; a stale `[default]` project does not leak into `login --profile b`; `--json` keys unchanged
8. [done] docs(cli:readme,auth-design,agents): where sessions live and how logout scopes
9. [done] release(cli): pull request opened with `nbx-ship --no-merge`; not merged here because merging `main` publishes to npm (release.yml) and the owner asked for no release

## Changes
| file (absolute, branch) | what changed | step |
|------|--------------|------|
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/session-per-project/src/lib/profiles.ts | `sessionKey`, `parseSessionKey`, `findSession`, `listSessions` returns the project; comment block | 2 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/session-per-project/src/base.ts | `requestedProjectId`, `sessionKey` on the context; session chosen for the requested project; refresher / adoption write the same file; "no project" hint lists the Hub's sign-ins | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/session-per-project/src/commands/login.ts | sign-in for the requested project only; "Signing in to … for project …" line; session + pending code keyed per project; `--wait` hint carries `--project` | 4 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/session-per-project/src/commands/logout.ts | one sign-in by default, `--all` for every one | 5 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/session-per-project/src/commands/profiles.ts | sign-ins listed with project and file | 6 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/session-per-project/src/commands/whoami.ts | `sessionFile` is the file in use; `Session:` line | 6 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/session-per-project/src/commands/env/use.ts | writes the env into the session in use | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/session-per-project/src/lib/session-auth.ts | refresher deps take `sessionKey` | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/session-per-project/test/session-per-project.test.ts | new — the 7 cases of step 7 | 7 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/session-per-project/test/hosts.test.ts, test/login.test.ts, tests/session-refresh.test.ts | existing cases follow the new file names and `logout --all` | 7 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/session-per-project/README.md, AUTH_DESIGN.md, docs/AGENTS.md | sessions per Hub and project; `logout` / `logout --all`; `--project` on both agent steps | 8 |

## Findings
- fix(cli:auth:sessions): the owner's report named `~/.norbix/session.json` (`SESSION_PATH`); on `main` that file is gone since the per-Hub sessions (1.19+). The bug is still real: two projects on one Hub shared `sessions/<hub>.json`, and the Hub pins a sign-in to the project asked at start (gateway `docs/tasks/cli-browser-sign-in.md`, "project pin"), so the second sign-in replaced a token the first project could use with one it cannot — fixed here
```ts
// before — sdks/cli/src/commands/login.ts:384-386 (main e311314)
  ): unknown {
    const now = Date.now()
    writeSession(ctx.hubKey, {            // <-- here: one file per Hub, whatever the project
      bearerToken: token.bearerToken,
```
```ts
// before — sdks/cli/src/base.ts:560 (main e311314)
    const projectId = flags.project ?? prof.project_id ?? session?.projectId ?? fromLegacy(legacy.projectId)
    //                                                     ^-- here: the last sign-in's project leaks into the next `norbix login`
```
- chore(git:cli): the main checkout `sdks/cli` is on `fix/sdk-1.3-and-deps` with 1 changed file (nbx-doctor WARN) — left as is, not mine

## Rejected / moved out
- decision(cli:auth:sessions): sessions keyed by profile name (`sessions/<profile>.json`, as the ask suggested) — rejected — a profile is only a pointer to a host and a project; `--project` with a profile, `NORBIX_PROJECT_ID`, and `--host` with no profile all need the same answer, so the file is keyed by what the Hub pins the token to: Hub + project. Two profiles for the same Hub and project share one sign-in, which is right.

## Needs you
- [ ] release(cli): merge the pull request when you want the patch published — `main` publishes to npm by itself (release.yml, semantic-release: `fix:` → 1.47.2) · action: approve + merge the PR (or `~/Projects/norbix/scripts/git/nbx-ship` from the worktree)

## Open questions
- none
