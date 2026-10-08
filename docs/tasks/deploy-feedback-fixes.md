# Deploy feedback fixes (CLI)
This file: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/docs/tasks/deploy-feedback-fixes.md (branch fix/deploy-feedback; after merge: /Users/djovaisas/Projects/norbix/sdks/cli/docs/tasks/deploy-feedback-fixes.md on main)

## Goal
Fix four usability bugs found while deploying with the CLI: ambiguous `hub membership role <id>`, "No project ID configured" for an account with one project, a `--dry-run` that does not check a schema bundle, and a misleading login hint for a dashboard host.
Not in scope: a `--hub` alias (asked not to add); validating `db schema create` (see Rejected).

## Plan
1. [done] fix(cli:hub:dispatch): words with no verb that fit several methods read — `role <id>` → getRole, `role` → getRoles; a write verb is never picked implicitly
2. [done] fix(cli:context:project): "No project ID configured" lists the account's projects in the hint; one project + browser sign-in → saved into the sign-in
3. [done] fix(cli:login:project): after a browser sign-in without a project, the account's only project is saved and named; several are listed with how to choose
4. [done] feat(cli:hub:dry-run): `hub database schema bundle apply --dry-run` also sends bundleJson to the Hub's read-only validateSchema, prints the issues, exits 6 when invalid
5. [done] fix(cli:login:hosts): a dashboard that answers /.well-known/norbix.json with its web page (and has no Hub at /v3) gets a hint that says so and names hub.<domain>
6. [done] docs(cli): README, docs/agent-contract.md and docs/database.md describe the new behaviour; `--dry-run` help says the server does not check the values
7. [done] release(cli): ship with nbx-ship (pull request, rebase merge)

## Changes
| file (absolute, branch fix/deploy-feedback) | what changed | step |
|------|--------------|------|
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/src/lib/dispatch.ts | `matchMethods(..., {hasId})` + `pickReadMethod` read tie-break | 1 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/src/lib/namespace-command.ts | passes `hasId` (positional or `--id`); clearer ambiguity hint; bundle dry-run validation (`validateBundle`) | 1, 4 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/tests/dispatch.test.ts | 7 matcher cases (role <id>, role, roles, typed verbs, no read fits, two reads tie, no hasId) | 1 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/tests/agent-mode.test.ts | end-to-end `hub membership role` with / without id / with `create` | 1 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/src/base.ts | `NoProjectError`, `accountProjects`, `adoptOnlyProject`, `explainNoProject` in `catch`; `DryRunValidation` in the dry-run report, exit 6 when invalid; `--dry-run` flag text | 2, 4 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/tests/_cli.ts | fake gateway takes fixed answers per path | 2, 4 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/tests/no-project.test.ts | new: several / one+session / one+API key / dry run | 2 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/src/commands/login.ts | `pickProject` after browser sign-in and `--wait` | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/test/login.test.ts | 3 cases: one project saved, several listed, project already there → no lookup | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/src/commands/hub.ts | description says what --dry-run checks; two examples | 4 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/tests/bundle-dry-run.test.ts | new: valid, invalid (json + text, exit 6), entities only, other dry runs unchanged | 4 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/src/lib/hosts.ts | `getJson` records content type + HTML; `wellKnownIsWebPage` error | 5 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/test/hosts.test.ts | web-page case (by body and by content type), 404 HTML keeps the old hint | 5 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/README.md | hub words, dry-run exception, project after sign-in, NOT_A_HUB row | 6 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/docs/agent-contract.md | rule 5: what a dry run checks, the bundle exception | 6 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/docs/database.md | dry run does not validate; bundle check | 6 |

Test evidence: `npm run build` ok, `npm run typecheck` ok, `npm test` 31 files / **882 passed** (baseline on origin/main c52173e: 29 files / 862 passed). The repo has no lint script and no linter config (CI runs build + tests only).

## Findings

fix(cli:hub:dispatch): `hub membership role <id>` failed as ambiguous; the positional id was never used to choose between createRole, deleteRole and getRole — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/src/lib/dispatch.ts:286 (branch fix/deploy-feedback)
```ts
// before — src/lib/namespace-command.ts:177-197 (origin/main c52173e)
    const matches = matchMethods(methods, words, moduleName)      // <-- here: the id is not passed
    ...
    if (matches.length > 1) {
      throw usageError(
        `"${words.join(' ')}" is ambiguous — did you mean: ${matches.map((m) => m.method).join(', ')}`,
        'Add a word (e.g. the verb) to be specific, or type the camelCase method name itself.',
```
```ts
// after — src/lib/dispatch.ts:283-291 and 304-319 (fix/deploy-feedback)
    const group = matches.filter((m) => m.exact === best.exact && m.extra === best.extra)
    if (group.length > 1 && opts.hasId !== undefined) {
      const read = pickReadMethod(methods, matches, userWords, opts.hasId)   // <-- added
      if (read) return [read]
    }
function pickReadMethod(methods: string[], matches: MethodMatch[], userWords: string[], hasId: boolean): MethodMatch | undefined {
  const verbs = new Set(methods.map((m) => camelSplit(m)[0]))
  if (userWords.some((w) => verbs.has(w))) return undefined                 // a typed verb decides
  const reads = matches.filter((m) => {
    const tokens = camelSplit(m.method)
    if (tokens[0] !== 'get' && tokens[0] !== 'list') return false            // never a write verb
    const last = tokens.at(-1) ?? ''
    const plural = tokens[0] === 'list' || singular(last) !== last
    return hasId ? !plural : plural                                          // id → one, no id → list
  })
```

fix(cli:context:project): with no project set, every command stopped with a hint that never named the account's projects — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/src/base.ts:761 (branch fix/deploy-feedback)
```ts
// before — src/base.ts:612-620 (origin/main c52173e)
    if (!ctx.projectId && !noProject) {
      throw usageError(
        'No project ID configured.',
        'Run `norbix configure` (or `norbix login`), pass --project <id>, or set NORBIX_PROJECT_ID.',   // <-- here: no projects listed
        'norbix configure --help',
      )
```
```ts
// after — src/base.ts:761-773 (fix/deploy-feedback); `catch` calls it through explainNoProject
  protected async adoptOnlyProject(flags: GlobalFlags): Promise<ProjectAdoption> {
    const ctx = this.resolveContext(flags)
    if (ctx.projectId || flags['dry-run'] || (!ctx.apiKey && !ctx.bearerToken)) return {state: 'not checked', projects: []}
    const projects = await this.accountProjects(flags)
    if (!projects) return {state: 'not checked', projects: []}
    if (projects.length === 0) return {state: 'none', projects}
    if (projects.length > 1) return {state: 'several', projects}
    const session = ctx.authSource === 'session' ? readSession(ctx.hubKey) : undefined
    if (!session) return {state: 'one', projects}
    writeSession(ctx.hubKey, {...session, projectId: projects[0].id})          // <-- the only project, saved to the sign-in
    return {state: 'saved', projects, projectId: projects[0].id}
  }
```

fix(cli:login:hosts): a dashboard that served its web page for /.well-known/norbix.json got "may be older than discovery", which hides the real cause (no ingress rule) — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/src/lib/hosts.ts:323 (branch fix/deploy-feedback)
```ts
// before — src/lib/hosts.ts:280-281 (origin/main c52173e)
    const res = await getJson(fetchFn, wellKnown)
    if (res.status >= 200 && res.status < 300) hubUrl = safeUrl(res.body?.hubUrl)   // <-- here: a 200 HTML page is dropped silently
```
```ts
// after — src/lib/hosts.ts:320-325 (fix/deploy-feedback)
  // 2xx with a web page: a dashboard's catch-all answered. /echo is still
  // asked — one origin may serve the dashboard at / and the Hub at /v3 — but
  // when it fails too, the error says what really happened.
  const webPage = !hubUrl && wellKnownRes.status >= 200 && wellKnownRes.status < 300 && wellKnownRes.html
  const notAHubHere = (url: string, detail: string) =>
    webPage ? wellKnownIsWebPage(origin, wellKnown, wellKnownRes.contentType) : notAHub(origin, url, detail)
```

decision(cli:login:hosts): the /echo probe is still sent after a 2xx HTML well-known answer, not skipped as asked — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/test/hosts.test.ts:147 (branch fix/deploy-feedback)
An existing test pins a real setup: one origin serves the dashboard at `/` (so its catch-all answers the well-known path with HTML) and the Hub at `/v3`. Skipping /echo would break it. The probe costs one request; only its error message changed.
```ts
// test/hosts.test.ts:147-155 (fix/deploy-feedback, unchanged from origin/main)
  it('a dashboard page instead of JSON (bad JSON) or JSON without hubUrl: the host is treated as the Hub', async () => {
    for (const body of ['<!doctype html><html>dashboard</html>', {other: 1}]) {
      const {fetch, urls} = fakeFetch({
        'hub.finlo.space/.well-known/norbix.json': {body},
        'hub.finlo.space/v3/echo': {body: FINLO_ECHO},       // <-- the Hub answers at /v3 behind the HTML well-known
      })
      expect((await discover('https://hub.finlo.space', {fetch})).hubUrl).toBe('https://hub.finlo.space/v3')
```

decision(cli:context:project): the error path saves the only project and says "run again" instead of using it in the same run — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/src/base.ts:668 (branch fix/deploy-feedback)
`client()` is synchronous and every command builds its client before any call; the project is only known after an async Hub call. Repeating the command from `catch` could send a write twice. So: login saves it up front (step 3); a command that fails saves it to the browser sign-in and asks for one more run. With an API key nothing is written (profiles are the user's file); the hint names the project and the `config set project_id` command.
```ts
// src/base.ts:666-668 (fix/deploy-feedback)
    const ctx = this.resolveContext(flags)
    this.assertEndpoints(ctx)
    const noProject = !ctx.projectId && opts.requireProject === false
    if (!ctx.projectId && !noProject) throw new NoProjectError(flags)    // <-- sync: the hint is filled in `catch`
```

feat(cli:hub:dry-run): a bundle dry run printed only the request, so a bundle the Hub rejects looked fine; now the Hub validates it (read-only) — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/src/lib/namespace-command.ts:212 (branch fix/deploy-feedback)
```ts
// after — src/lib/namespace-command.ts:212-214 (fix/deploy-feedback); SDK @norbix.ai/ts 4.18.1 has hub.account.validateSchema
    if (flags['dry-run'] && this.target === 'hub' && method === 'applyDatabaseSchemaBundle') {
      this.dryRunValidation = await this.validateBundle(flags, request)    // POST /v3/account/ai/schemas/validate {schemaJson}
    }
```
```ts
// after — src/base.ts:823-827 (fix/deploy-feedback)
      // The Hub said the input is wrong: the report is printed, the exit code says "would fail" (6).
      if (this.dryRunValidation?.valid === false) {
        const invalid = new Error('dry run: the Hub rejected the input') as Error & {oclif?: {exit?: number}; skipOclifErrorHandling?: boolean}
        invalid.oclif = {exit: EXIT.VALIDATION}
```

fix(cli:context:region): on hub.norbix.ai with no region set, the project lookup cannot run, so login and the "no project" hint fall back to the plain message — todo (not fixed here)
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/deploy-feedback/src/base.ts:374 (branch fix/deploy-feedback)
The region is found from the project (`prepareRegion` needs `ctx.projectId`), and `client()` needs a region on the default norbix.ai endpoints — so with neither, `accountProjects` gets a "Region is required" error and returns undefined. Self-hosted Hubs (cloud.finlo.space) are not affected: there the region is optional.
```ts
// src/base.ts:374-376 (fix/deploy-feedback, unchanged)
  private async prepareRegion(flags: GlobalFlags): Promise<void> {
    const ctx = this.resolveContext(flags)
    if (!ctx.usesDefaultEndpoints || ctx.region || !ctx.projectId || !(ctx.apiKey || ctx.bearerToken)) return   // <-- no project → no region
```

## Rejected / moved out
- decision(cli:db:schema): `db schema create --dry-run` is not validated — rejected — it takes a JSON Schema of one record (`dataSchema`), while `validateSchema` reads the IF schema format; sending one to the other would report false issues. The docs say it is not checked. New ticket: none.
- decision(cli:hub): no `--hub` alias — rejected — asked not to add it.
- chore(cli:git): main checkout /Users/djovaisas/Projects/norbix/sdks/cli is on `fix/sdk-1.3-and-deps` with an untracked docs/tasks/agent-native-cli.md — not mine, untouched.
- chore(cli:git): other CLI worktrees — not mine, untouched. `git cherry origin/main` shows no unmerged patches on fix/error-answers, fix/login-config-account, fix/push-managed-app, chore/release-minor-until-launch, feat/service-users-keys. `feat/agent-native-cli-3` (/Users/djovaisas/Projects/norbix/worktrees/sdks/cli/feat/agent-native-cli) and `fix/sdk-1.3-and-deps` show patches not matched by id but touching base.ts / login; their content (dry-run middleware, agent-mode tests, browser login) is already on origin/main in reworked form, so they look superseded, not pending.

## Needs you

## Open questions
