# P13 — CLI: login, keys, one config file, account and email fixes
This file: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/docs/tasks/p13-login-config-account.md (branch fix/login-config-account)

## Goal
Answer the three CLI questions from prompt P13 with code evidence, then fix what is still broken: login on a Linux box with no desktop, `account projects` / `account status`, and `email integration save` with a `viewId`.
Not in scope: the gateway side of `account status` for a service user (needs a gateway change — handed to a separate task); the redesign of project / account service users with role arrays (prompt P3); `files publish` project header (not asked in this run, see Findings).

## Plan
1. [done] decision(cli:login): drop --user / --password; browser sign-in for people, a service-user key for scripts   ref: P13 q1, item 78
2. [done] feat(cli:apikeys): `apikeys` manages service-user keys (list / create / regenerate / revoke) instead of the dead /apikeys route   ref: P13 q2, item 79
3. [done] feat(cli:config): one config file — `config set/get/list/unset` write profiles in ~/.norbix/config, honour --profile, accept both key spellings   ref: P13 q3, item 81
4. [done] fix(cli:login): `login --api-key --profile` stores the Api / Hub hosts (new --api-url / --hub-url flags, or NORBIX_API_URL / NORBIX_HUB_URL)   ref: P13 q3
5. [done] feat(cli:json): every JSON flag takes @file (db insert-many --docs @orders.json)   ref: P13 q3
6. [done] docs(cli:configure): the localhost example had the Api and Hub ports swapped   ref: P13 q3
7. [done] fix(cli:login): Linux without a desktop prints the link and keeps waiting instead of crashing on xdg-open   ref: F44
8. [done] fix(cli:account): `account projects` and `account status` need no project (CLI side)   ref: F45
9. [done] fix(cli:email:integrations): save with a viewId (or the whole object from `get`) updates that integration   ref: F46
10. [doing] release(cli): pull request merged, minor release 1.18.0

## Answers to the three questions

**1. Password login.** Still broken in 1.17 and not worth keeping. `login --user --password` called the SDK `client.login`, which posts to the **Api** `/auth`; account users live on the Hub, so it can only answer 401. The old test proved the host: `'POST api.test/auth'`. Decision (owner leaned the same way): the flags are removed. People use the browser sign-in; scripts and CI save a service-user key with `login --api-key` or set `NORBIX_API_KEY`. A Hub without the browser sign-in now stops with a usage error that points at `--api-key` instead of falling back to the password.

**2. `apikeys`.** Still broken: `apikeys list` called `client.api.apikeys.getApiKeys` — the old ServiceStack keys route, 405. Decision: the topic stays and manages service-user keys — `list` / `create` / `regenerate` / `revoke` — on the endpoints that work today (`/account/ai/service-users/{id}/keys`; the `nbsu_` keys are the only keys that authenticate SDK / CLI / REST today, see P3). When P3 adds project and account service users with role arrays, these four commands get the new user ids; the command shape does not change.

**3. Config files.** All five points were still true. Decision: yes — one file, `~/.norbix/config` with profiles, one key spelling in the file (`snake_case`, `hub_url`), camelCase accepted as input. `config set/get/unset/list` now work on `[default]` or `--profile`; `env use` creates `[default]` instead of writing the old file; the old `~/.config/norbix/config.json` is only read as the last fallback and shown by `config list`. `login --api-key --profile ci` now saves the hosts. Every JSON flag takes `@file`. The configure example ports are fixed (Hub 5001, Api 5002).

## Changes
| file (absolute, branch fix/login-config-account) | what changed | step |
|------|--------------|------|
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/lib/device-login.ts | `openBrowser` listens for the spawn `error` event; new `canOpenBrowser()` | 7 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/login.ts | password flow removed; no browser prompt without a desktop; `--api-url` / `--hub-url` saved with `--api-key` | 1, 4, 7 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/account/projects.ts | `requireProject: false` | 8 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/account/status.ts | `requireProject: false` | 8 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/email/integration/save.ts | `viewId` / `id` → `integrationId`, read-only fields dropped, `{integration: …}` unwrapped | 9 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/lib/json.ts | `@path` for every JSON flag | 5 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/db/insert-many.ts | help text and example with `@orders.json` (same help change in 8 more db commands and `raw`) | 5 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/configure.ts | localhost example: `--api-url :5002 --hub-url :5001` | 6 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/lib/profiles.ts | `profileKey()` maps camelCase to the file key | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/config/set.ts | (and get / unset / list) work on profiles | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/env/use.ts | last resort creates `[default]`, never the old file | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/lib/store.ts | old file: read-only fallback; `SETTABLE_KEYS` removed | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/apikeys/list.ts | (and new create.ts, revoke.ts; regenerate.ts rewritten) on service-user keys | 2 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/tests/config.test.ts | new: 8 tests for one config file | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/test/login.test.ts | no desktop, no password fallback, --api-key hosts | 1, 4, 7 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/test/device-login.test.ts | spawn ENOENT, `canOpenBrowser` | 7 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/README.md | login, config, apikeys sections | 1–3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/AUTH_DESIGN.md | password fallback removed | 1 |

Tests: 780 before, 807 after (`npm test`, build + vitest, 29 files) — all pass.

## Findings

fix(cli:login): on Linux without a desktop, `norbix login` crashed with "spawn xdg-open ENOENT" — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/lib/device-login.ts:253 (branch fix/login-config-account)   ref: F44
```ts
// before — src/lib/device-login.ts:245-254 (main 2e36bfa)
export function openBrowser(url: string): void {
  const href = toHttpUrl(url)
  if (!href) return
  const [cmd, args] = browserCommand(href, process.platform)
  try {
    spawn(cmd, args, {detached: true, stdio: 'ignore'}).unref()   // <-- here: ENOENT comes as an 'error' event, not a throw — no listener, Node crashes
  } catch {
    // Browser could not be opened — the URL is printed anyway.
  }
}
```
```ts
// after — same file:249-256, plus login.ts:142 skips the ENTER prompt when !canOpenBrowser()
  try {
    const child = spawn(cmd, args, {detached: true, stdio: 'ignore'})
    // A missing opener (no xdg-open on a server) is reported as an 'error'
    // event, not thrown: without a listener Node crashes the whole login.
    child.on('error', () => {})                                     // <-- added
    child.unref()
```
The test `a missing opener (spawn ENOENT) does not crash the login` fails with `Unhandled Errors … spawn open ENOENT` when the listener line is commented out (checked).

fix(cli:login): password login posted to the Api, where no account user exists, so it always got 401 — done (flags removed)
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/login.ts:96 (branch fix/login-config-account)   ref: P13 q1
```ts
// before — src/commands/login.ts:198-204 (main 2e36bfa)
    const ctx = this.resolveContext({...flags, project: projectId, region})
    const client = new Norbix(
      {projectId, region, env: flags.env ?? existing.env, baseUrl: {api: ctx.apiUrl, hub: ctx.hubUrl}},
      {envSource: {}},
    )
    const res = await client.login({userName, password: pwd})   // <-- here: POST {api}/auth — accounts live on the Hub
```
```ts
// the old test that showed the host — test/login.test.ts (main 2e36bfa)
    expect(hits.map((h) => `${h.method} ${new URL(h.url).host}${new URL(h.url).pathname}`)).toEqual([
      'GET hub.test/v3/echo',
      'POST hub.test/v3/auth/device/start',
      'POST api.test/auth',                                       // <-- the Api, not the Hub
    ])
```

fix(cli:apikeys): `apikeys list` called the old ServiceStack keys route, which answers 405 — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/apikeys/list.ts:21 (branch fix/login-config-account)   ref: P13 q2
```ts
// before — src/commands/apikeys/list.ts:12 (main 2e36bfa)
    const res = await client.api.apikeys.getApiKeys({environment: flags.env})   // <-- here: dead route, 405
```
```ts
// after — same file:20-30
    const res = await client.hub.account.listAiServiceUsers({})
    const keys = (res.items ?? []).flatMap((user) =>
      (user.keys ?? []).map((key) => ({
        serviceUserId: user.id,
        serviceUser: user.name,
        keyId: key.id,
        hint: key.hint,
        issuedAt: key.issuedAt,
      })),
    )
```

fix(cli:config): `config set` wrote a second file with other key names and ignored --profile — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/config/set.ts:40 (branch fix/login-config-account)   ref: P13 q3
```ts
// before — src/commands/config/set.ts:38-39 (main 2e36bfa)
    const stored = this.readStore()
    writeStore(this.config.configDir, {...stored, [args.key]: args.value})   // <-- here: ~/.config/norbix/config.json, camelCase, no --profile
```
```ts
// the file every other command reads — src/lib/profiles.ts:20,41 (main 2e36bfa)
 *   hub_url = https://hub.norbix.ai          // <-- ~/.norbix/config, snake_case, per profile
  hub_url?: string
```
```ts
// after — src/commands/config/set.ts:32-40
    const key = profileKey(args.key)                       // projectId → project_id
    ...
    const profile = flags.profile ?? 'default'
    ...
    writeProfile(profile, {...readProfiles()[profile], [key]: args.value})
```

fix(cli:login): `login --api-key --profile ci` saved no hosts, so a self-hosted profile pointed at norbix.ai — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/login.ts:80 (branch fix/login-config-account)   ref: P13 q3
```ts
// after — src/commands/login.ts:74-82 (before: only api_key, project_id, region were written)
      writeProfile(profName, {
        ...existing,
        api_key: flags['api-key'],
        project_id: projectId,
        region: flags.region ?? existing.region,
        api_url: flags['api-url'] ?? envUrl('NORBIX_API_URL') ?? existing.api_url,   // <-- added
        hub_url: flags['hub-url'] ?? envUrl('NORBIX_HUB_URL') ?? existing.hub_url,   // <-- added
      })
```

fix(cli:db): `db insert-many --docs` took no @file, while `db seed` did — done (every JSON flag now does)
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/lib/json.ts:8 (branch fix/login-config-account)   ref: P13 q3
```ts
// before — src/lib/json.ts:6 (main 2e36bfa)
  const raw = value === '-' ? await readStdin() : value          // <-- here: "@orders.json" was parsed as JSON and failed
```
```ts
// after — same file:8
  const raw = value === '-' ? await readStdin() : value.startsWith('@') ? readJsonFile(value.slice(1), flagName) : value
```

docs(cli:configure): the localhost example swapped the ports — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/configure.ts:25 (branch fix/login-config-account)   ref: P13 q3
```diff
-    '<%= config.bin %> configure --profile localhost --api-url http://localhost:5001 --hub-url http://localhost:5002',
+    '<%= config.bin %> configure --profile localhost --api-url http://localhost:5002 --hub-url http://localhost:5001',
```
Checked against gateway launchSettings: Community.Hub → localhost:5001, Community.Api → localhost:5002.

fix(cli:account): `account projects` and `account status` stopped at "No project ID configured" for a key with no project — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/account/projects.ts:10 (branch fix/login-config-account)   ref: F45
```ts
// before — src/commands/account/projects.ts:10 (main 2e36bfa); status.ts the same
    const client = this.client(flags)                           // <-- here: demands a project for an account call
```
```ts
// after
    const client = this.client(flags, {requireProject: false})
```
The new tests in tests/account-routes.test.ts failed with `CliError: No project ID configured.` before the change (seen against the old build).

blocked(gateway:account:status): `account status` still answers "User not specified" for an AI service user — the gateway requires a person user id — needs you
    action: start the suggested task "Fix account status for AI service users in gateway" (gateway, refactoringV2)   ref: F45
```csharp
// gateway/src/Application.Layer/Queries/Account/FetchAccountStatusQuery.cs:53-56 (refactoringV2)
        if (ctx.UserId is null)
        {
            return Result.Fail(new UserNotSpecifiedError());     // <-- here: a service user has ctx.ServiceUser, not ctx.UserId
        }
```

fix(cli:email:integrations): save with a viewId created a second integration — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/email/integration/save.ts:48 (branch fix/login-config-account)   ref: F46
```ts
// before — src/commands/email/integration/save.ts:41-49 (main 2e36bfa)
    const integration = {
      ...extra,                                                  // <-- viewId from `get` is passed through; the gateway ignores it
      provider: flags.provider,
      integrationId: flags.id,                                   // <-- here: undefined unless --id → gateway makes IntegrationId.New()
      integrationName: flags.name ?? '',                         // <-- also blanked the name from --config
      emailAddress: flags.from ?? (extra.emailAddress as string | undefined),
      emailSenderName: flags['sender-name'] ?? (extra.emailSenderName as string | undefined),
      isEnabled: !flags.disabled,
    }
```
```csharp
// gateway/src/Isidos.CodeMash.Gateway.Hub.Emails/Integrations/Save_.cs:41-43 (refactoringV2) — only IntegrationId is read
        var integrationIdResult = string.IsNullOrEmpty(IntegrationId)
            ? Result.Ok(Domain.IntegrationId.New())
            : IntegrationId.Required(IntegrationIdMapper.Map, nameof(IntegrationId));
```

fix(cli:files:publish): `files publish / unpublish` still send the project as X-CM-ProjectId, which the gateway does not read — todo (not in this run's ask)
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/lib/publicFiles.ts:72 (branch fix/login-config-account)   ref: P13 (docs-program prompt)
```ts
// src/lib/publicFiles.ts:71-73
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (ctx.projectId) headers.set('X-CM-ProjectId', ctx.projectId)   // <-- here: other commands send norbix-project-id
  if (ctx.accountId) headers.set('X-CM-AccountId', ctx.accountId)
```

fix(cli:ai:service-users): `ai service-user create` still sends the old `scope` body (CM-ERRORS-AI-SU-016) — todo, belongs to P3
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-config-account/src/commands/ai/service-user/create.ts:33 (branch fix/login-config-account)   ref: P3

## Rejected / moved out
- decision(gateway:account:status): the gateway half of F45 is not done here — this run is CLI only; handed to a separate gateway task (chip in the session)
- decision(cli:files:publish): X-CM-ProjectId header not fixed — it was not in this run's list; left for P13's files part
- decision(cli:ai:service-users): `ai service-user create` roles body left to P3 (needs the gateway's new service-user model)
- chore(cli:main-checkout): main checkout /Users/djovaisas/Projects/norbix/sdks/cli is on fix/sdk-1.3-and-deps with an untracked docs/tasks/agent-native-cli.md — not mine, untouched

## Needs you
- [ ] blocked(gateway:account:status): `account status` for a service user needs the gateway change — needs you · action: start the task "Fix account status for AI service users in gateway"

## Open questions
- none
