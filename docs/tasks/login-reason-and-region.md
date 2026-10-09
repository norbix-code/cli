# Login: server reason on a refused sign-in, and project lookup without a region (CLI)
This file: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-reason-and-region/docs/tasks/login-reason-and-region.md (branch fix/login-reason-and-region; after merge: /Users/djovaisas/Projects/norbix/sdks/cli/docs/tasks/login-reason-and-region.md on main)

## Goal
`norbix login` shows the server's own words when a browser sign-in is refused (with a hint for an unverified email), and on hub.norbix.ai with no region the account's projects are read from the account Hub and the project's region is saved with the project.
Not in scope: gateway changes (read only; the needed change is under Findings / Needs you).

## Plan
1. [doing] docs(cli:tasks): this task file
2. [todo] fix(cli:login:device): a refused sign-in prints the Hub's error description and code; email-not-verified / blocked / unregistered get their own hint
3. [todo] fix(cli:context:region): account-level project lookup works on hub.norbix.ai with no region; the only project's region is saved with it
4. [todo] release(cli): build, typecheck, full tests, ship with nbx-ship (pull request, rebase merge)

## Changes
| file (absolute, branch fix/login-reason-and-region) | what changed | step |
|------|--------------|------|

## Findings

## Rejected / moved out

## Needs you

## Open questions
