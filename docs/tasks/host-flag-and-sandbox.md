# CLI: --host on hub/api, Fake → Sandbox
This file: /Users/djovaisas/Projects/norbix/worktrees/sdks/cli/fix/host-flag/docs/tasks/host-flag-and-sandbox.md (branch fix/host-flag)

## Goal
`norbix hub` / `norbix api` honour `--host` (and every other global flag), and the CLI calls the built-in test provider "Sandbox" everywhere a user reads it.
Not in scope: the gateway's enum / API value `Fake`, generated request-field data (src/generated), MCP tool names. Tracking file of the whole batch: /Users/djovaisas/Projects/norbix/worktrees/gateway/fix/small-batch/docs/tasks/small-fixes-batch.md (branch fix/small-batch) — owned by the tracking session.

## Plan
1. [done] fix(cli:hub:host): `hub` and `api` keep --host, --language and --prod as global flags; discovery runs for the --host target — owner item 6
2. [done] feat(cli:integrations:labels): `--provider Sandbox` replaces `--provider Fake` for email / SMS / push; the request still sends `Fake` — owner item 7
3. [doing] release(cli): ship through nbx-ship (rebase merge) and cut a release

## Changes
| file (absolute, branch fix/host-flag) | what changed | step |
|------|--------------|------|
| /Users/djovaisas/Projects/norbix/worktrees/sdks/cli/fix/host-flag/src/lib/namespace-command.ts | `knownFlags()` derives the global / command flag names; `discoveryArgv()` returns the split global part | 1 |
| /Users/djovaisas/Projects/norbix/worktrees/sdks/cli/fix/host-flag/src/base.ts | `init()` parses `discoveryArgv()` and gives back the argv oclif overwrote | 1 |
| /Users/djovaisas/Projects/norbix/worktrees/sdks/cli/fix/host-flag/tests/namespace-host.test.ts | new: two fake gateways ([default] profile host vs --host); 6 tests | 1 |
| /Users/djovaisas/Projects/norbix/worktrees/sdks/cli/fix/host-flag/src/lib/providers.ts | new: `providerFlag()` — options Sandbox + real providers, Sandbox → `Fake` on the wire | 2 |
| src/commands/{email,sms,push}/integration/{save,test}.ts | help, examples and flag texts say Sandbox | 2 |
| src/commands/code/runs.ts, src/commands/code/marketplace/runs.ts, src/lib/code.ts, src/lib/marketplace.ts | "Fake provider/vendor" → "Sandbox provider/vendor (API value Fake)" | 2 |
| docs/{email,sms,push,code}.md | same rename | 2 |
| tests/{email,sms,push}-routes.test.ts | Sandbox sends `Fake`; `--provider Fake` is refused with a list that names Sandbox | 2 |

## Findings

fix(cli:hub:host): `--host` (also `--language`, `--prod`) was not in the hand-kept global flag list, so it became a request field and the [default] profile host was used — done
    where: /Users/djovaisas/Projects/norbix/worktrees/sdks/cli/fix/host-flag/src/lib/namespace-command.ts:59 (branch fix/host-flag)
```ts
// before — src/lib/namespace-command.ts:39-41 (origin/main 7dc7298)
  protected splitArgv(): {flagArgv: string[]; rest: string[]; help: boolean} {
    const VALUE_FLAGS = new Set(['--project', '--env', '--region', '--api-key', '--account', '--profile', '--body'])   // <-- missing: --host, --language
    const BOOL_FLAGS = new Set(['--json', '--yes', '-y', '--dry-run'])                                                  // <-- missing: --prod
```
```ts
// after — src/lib/namespace-command.ts:59-61 (fix/host-flag)
  protected splitArgv(): {flagArgv: string[]; rest: string[]; help: boolean} {
    const ctor = this.constructor as typeof NamespaceCommand
    const {VALUE_FLAGS, BOOL_FLAGS} = knownFlags({...BaseCommand.baseFlags, ...ctor.flags})
```

fix(cli:base:discovery): `init()` parsed the full argv of `hub`/`api`, failed on the request fields, swallowed the error and skipped host discovery; and oclif's `parse` overwrites `this.argv` — done
    where: /Users/djovaisas/Projects/norbix/worktrees/sdks/cli/fix/host-flag/src/base.ts:370 (branch fix/host-flag)
```ts
// after — src/base.ts:374-384 (fix/host-flag)
    let flags: GlobalFlags
    // oclif's parse replaces this.argv with what it parsed; `run` needs the whole argv back.
    const argv = this.argv
    try {
      flags = (await this.parse(ctor as unknown as Parameters<typeof this.parse>[0], this.discoveryArgv())).flags as GlobalFlags
    } catch {
      return
    } finally {
      this.argv = argv      // <-- without this, `hub scheduler tasks get` lost its words and listed the modules
    }
```
```ts
// the test that proves it — tests/namespace-host.test.ts:45-51 (fix/host-flag); fails on origin/main, passes here
  it('hub <request> --host X goes to X, not to the [default] profile host', async () => {
    const r = await cli(home, ['hub', 'scheduler', 'tasks', 'get', ...target(), '--json'])
    expect(r.code, r.stderr).toBe(0)
    expect(byDefault.hits).toHaveLength(0)
    expect(byFlag.hits).toHaveLength(1)
```

## Rejected / moved out
- decision(cli:integrations): keep `Fake` as a hidden alias of `--provider` — rejected — reason: oclif checks `options` before `parse`, so an alias means dropping `options` and `norbix schema` would lose the provider list agents read; Norbix has no tenants yet (greenfield), so no back-compat. `--provider Fake` now fails with "Expected --provider=Fake to be one of: Sandbox, …".
- chore(cli): main checkout /Users/djovaisas/Projects/norbix/sdks/cli is on fix/sdk-1.3-and-deps with 1 changed file — not mine, untouched.

## Needs you
- none

## Open questions
- none
