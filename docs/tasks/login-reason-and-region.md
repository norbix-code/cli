# Login: server reason on a refused sign-in, and project lookup without a region (CLI)
This file: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-reason-and-region/docs/tasks/login-reason-and-region.md (branch fix/login-reason-and-region; after merge: /Users/djovaisas/Projects/norbix/sdks/cli/docs/tasks/login-reason-and-region.md on main)

## Goal
`norbix login` shows the server's own words when a browser sign-in is refused (with a hint for an unverified email), and on hub.norbix.ai with no region the account's projects are read from the account Hub and the project's region is saved with the project.
Not in scope: gateway changes (read only; the change the gateway needs is under Findings and Needs you).

## Plan
1. [done] docs(cli:tasks): this task file
2. [done] fix(cli:login:device): a refused sign-in prints the Hub's error description (camelCase or snake_case); the account reasons EmailNotVerified / Blocked / Unregistered get their own hint; the code stays ACCESS_DENIED, `--json` gets `context.reason` and `context.errorCode`
3. [done] fix(cli:context:region): account-level project lookup goes to the account Hub with no region on norbix.ai; the only project is saved with its primary region; "no project" is reported before "no region"
4. [done] release(cli): build, typecheck, full tests, ship with nbx-ship (pull request, rebase merge)

Test evidence: `npm run build` ok, `npm run typecheck` ok, `npm test` 31 files / **892 passed** (baseline on origin/main 9d12d82: 31 files / 882 passed; 10 new). No lint script in the repo.

## Changes
| file (absolute, branch fix/login-reason-and-region) | what changed | step |
|------|--------------|------|
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-reason-and-region/docs/tasks/login-reason-and-region.md | this file | 1 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-reason-and-region/src/lib/device-login.ts | `accessDeniedError`, `denialReason`, `DeviceTokenError`; reads `error_description` too | 2 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-reason-and-region/src/lib/cli-error.ts | `CliError.context`, passed into the JSON envelope | 2 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-reason-and-region/test/device-login.test.ts | 7 cases: plain denial, unverified email (message + hint + context), 4 reason sources, snake_case description | 2 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-reason-and-region/tests/cli-error.test.ts | envelope keeps a CliError's context | 2 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-reason-and-region/README.md | login table row "Allow, but the Hub refuses"; project-after-sign-in paragraph: region on norbix.ai | 2, 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-reason-and-region/docs/AGENTS.md | ACCESS_DENIED with `context.reason` EmailNotVerified: ask the person to verify first | 2 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-reason-and-region/src/base.ts | `client(..., {account: true})` skips the region rule and uses the account Hub; no-project check before the region check; `accountProjects` returns the region; `adoptOnlyProject` saves it (session + region cache), norbix.ai only | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-reason-and-region/src/commands/login.ts | `pickProject` names the region and returns it | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-reason-and-region/test/login.test.ts | managed hub.norbix.ai with no region (lookup on hub.norbix.ai, region saved); self-hosted (no region saved) | 3 |

## Findings

fix(cli:login:device): a refused browser sign-in always printed "Sign-in was denied in the browser." and dropped whatever the Hub said — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-reason-and-region/src/lib/device-login.ts:287 (branch fix/login-reason-and-region)
```ts
// before — src/lib/device-login.ts:192-199 (origin/main 9d12d82)
      case 'access_denied':
        throw new CliError({
          exit: EXIT.AUTH,
          code: 'ACCESS_DENIED',
          message: 'Sign-in was denied in the browser.',      // <-- here: errorDescription / errorCode ignored
          hint: 'Run `norbix login` again and choose Allow on the dashboard page.',
          docs: 'norbix login --help',
        })
```
```ts
// after — src/lib/device-login.ts:287-298 (fix/login-reason-and-region)
export function accessDeniedError(data: DeviceTokenError): CliError {
  const description = data.errorDescription?.trim()
  const reason = denialReason(data)                       // reason / context.Reason, or CM-ERRORS-ACCOUNT-003 + its text
  const plain = !description || (data.errorCode === PLAIN_DENIAL_CODE && !reason)
  return new CliError({
    exit: EXIT.AUTH,
    code: 'ACCESS_DENIED',
    message: plain ? 'Sign-in was denied in the browser.' : `Sign-in was refused: ${description}`,
    hint: reason ? DENIAL_HINTS[reason] : 'Run `norbix login` again and choose Allow on the dashboard page.',
    docs: 'norbix login --help',
    context: compactContext({reason, errorCode: data.errorCode && data.errorCode !== PLAIN_DENIAL_CODE ? data.errorCode : undefined}),
  })
```
```ts
// the test — test/device-login.test.ts:221 (fix/login-reason-and-region)
  it('access_denied refused for an unverified email shows the Hub message and the verify hint', async () => {
    ...{body: {error: 'access_denied', errorCode: 'CM-ERRORS-ACCOUNT-003', errorDescription: description, reason: 'EmailNotVerified'}}
      hint: 'Verify your email in the dashboard (banner → Resend), then run `norbix login` again.',
      context: {reason: 'EmailNotVerified', errorCode: 'CM-ERRORS-ACCOUNT-003'},
```

blocked(gateway:ai:device-sign-in): the gateway does NOT pass the account reason to the CLI poller — a refused Allow never reaches the CLI at all; the CLI keeps waiting until the code expires (EXPIRED_TOKEN after 10 minutes) — needs you (gateway change, not made here)
    where: /Users/djovaisas/Projects/norbix/gateway/src/Application.Layer/Commands/SecuredAccountCommandWithIdResult.cs:48 (branch refactoringV2, e5b112d66)
Allow and Deny both go through the account-status gate of the secured command; on a not-active account it answers the dashboard with 403 and the message only (the `Reason` metadata is dropped), and the device-code row is never changed, so it stays Pending:
```csharp
// gateway/src/Application.Layer/Commands/SecuredAccountCommandWithIdResult.cs:48-58 (refactoringV2)
        if (EnforceAccountIsActive)
        {
            var accountId = GetAccountId(request);
            var policy = Request?.TryResolve<IAccountStatusPolicy>();
            if (accountId is not null && policy is not null)
            {
                var accountActiveResult = await policy.IsAccountActive(accountId);
                if (accountActiveResult.IsFailed)
                {
                    return IdResponse.Error(new HttpError(HttpStatusCode.Forbidden, "Forbidden", accountActiveResult.Errors.First().Message));   // <-- here: dashboard only; row stays Pending, Reason lost
```
The poller only ever hears `access_denied` after a real Deny, and then with a fixed text and no reason:
```csharp
// gateway/src/Application.Layer/Commands/Account/AiOAuth/AiDeviceSignInCommands.cs:234-235 (refactoringV2)
        if (row.Status == AiDeviceCodeStatus.Denied)
            return FluentResults.Result.Fail(new AiOAuthAccessDeniedError());   // <-- here: always "The person signed in to Norbix did not allow this access." (CM-ERRORS-AI-OAUTH-014)
```
```csharp
// gateway/src/Isidos.CodeMash.Gateway.Hub.AI/OAuth/DeviceSignIn.cs:202-211 (refactoringV2) — the poll answer has no reason field
    private AuthDeviceTokenResponse ErrorAnswer(IEnumerable<IError> errors)
    {
        var body = AiOAuthErrorMapper.Map(errors);
        return Answer(new AuthDeviceTokenResponse
        {
            ResponseStatus = CodeMashResponseStatus.Success,
            Error = body.Error,
            ErrorDescription = body.ErrorDescription,
            ErrorCode = body.ErrorCode,                     // <-- missing: Reason (EmailNotVerified | Blocked | Unregistered)
        });
```
Gateway change needed (the CLI side is ready for it — it reads `reason`, `context.Reason`, or `errorCode` CM-ERRORS-ACCOUNT-003 + the description):
1. `DecideAiDeviceConsentCommand`: `protected override bool EnforceAccountIsActive => false;` and, on Allow, check the account status itself; when it is not active, mark the device code Denied **with the error** (store code CM-ERRORS-ACCOUNT-003, message and Reason on the device-code row, e.g. new fields `DeniedErrorCode`, `DeniedMessage`, `DeniedReason` in AiOAuthStore), then return the same reasoned error to the dashboard.
2. `PollAiDeviceTokenCommand`: a Denied row with a stored error returns that error (oauth name `access_denied`, its message, its code) instead of `AiOAuthAccessDeniedError`.
3. `AuthDeviceTokenResponse`: add `public string? Reason { get; init; }` (wire `reason`), filled from the error's `Reason` metadata in `ErrorAnswer`.
The cloud /device page already shows "Verify your email before signing in the CLI" instead of Allow for this case (gateway docs/tasks/email-verification-banner.md step 11), so in practice the person rarely gets to press Allow; this change makes the terminal say the same instead of waiting 10 minutes.

fix(cli:context:region): on hub.norbix.ai with no region, the post-login project lookup and the "no project" hint never ran — the client stopped at "Region is required" — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-reason-and-region/src/base.ts:676 (branch fix/login-reason-and-region)   ref: deploy-feedback-fixes.md finding fix(cli:context:region)
```ts
// before — src/base.ts:665-668 and 745 (origin/main 9d12d82)
    const ctx = this.resolveContext(flags)
    this.assertEndpoints(ctx)                                  // <-- here: norbix.ai + no region → throws, even for account/projects
    const noProject = !ctx.projectId && opts.requireProject === false
    if (!ctx.projectId && !noProject) throw new NoProjectError(flags)
      const client = this.client({...flags, 'dry-run': false} as GlobalFlags, {requireProject: false})   // <-- the error is swallowed: undefined
```
```ts
// after — src/base.ts:669-677 (fix/login-reason-and-region)
    const ctx = this.resolveContext(flags)
    const noProject = !ctx.projectId && opts.requireProject === false
    // No project first: on norbix.ai the region comes from the project, so
    // "Region is required" would hide the real cause (and its project list).
    if (!ctx.projectId && !noProject) throw new NoProjectError(flags)
    // An account-level call (Hub account/*) needs no region: with none set on
    // norbix.ai it goes to the account Hub (hub.norbix.ai), not a regional one.
    const accountHub = opts.account === true && ctx.usesDefaultEndpoints && !ctx.region
    if (!accountHub) this.assertEndpoints(ctx)
```
```ts
// after — src/base.ts:788-796 (fix/login-reason-and-region): the project is saved with its region, norbix.ai only
    const [only] = projects
    const region = ctx.usesDefaultEndpoints && !ctx.region ? only.region : undefined
    if (region) saveProjectRegion(ctx.hubKey, only.id, region)
    const session = ctx.authSource === 'session' ? readSession(ctx.hubKey) : undefined
    if (!session) return {state: 'one', projects}
    writeSession(ctx.hubKey, {...session, projectId: only.id, ...(region ? {region} : {})})
```
```ts
// the test — test/login.test.ts:211 (fix/login-reason-and-region); fails on origin/main (no account/projects call at all)
    expect(lookup).toMatchObject({method: 'GET', url: 'https://hub.norbix.ai/v3/account/projects'}) // not <region>.hub.norbix.ai
    const session = readJson(sessionPath('hub.norbix.ai'))
    expect([session.projectId, session.region]).toEqual(['p-only', 'nb-eu-germany'])
```

decision(cli:context:region): use the SDK client against the account Hub rather than a new hand-written fetch — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/fix/login-reason-and-region/src/base.ts:758 (branch fix/login-reason-and-region)
The SDK @norbix.ai/ts 4.18.1 never requires a region (no region → no `nb-region` header, default URLs not rewritten); the "Region is required" rule is the CLI's own `assertEndpoints`. With no region on norbix.ai `ctx.hubUrl` is already the account Hub, the same one `fetchProjectRegion` and the sign-in use (`ctx.authHubUrl`). `ProjectListItemDto.primaryRegion.id` carries the region, so no second call is needed.

## Rejected / moved out
- decision(cli:login:region): when the sign-in itself carries a project (gateway returns projectId), login does not look up its region — rejected — the first command does it already (`prepareRegion`, cached for a week); new ticket: none.
- chore(cli:git): main checkout /Users/djovaisas/Projects/norbix/sdks/cli is on `fix/sdk-1.3-and-deps` with 1 changed file (nbx-doctor WARN) — not mine, untouched.

## Needs you
- [ ] blocked(gateway:ai:device-sign-in): make a refused Allow end the CLI wait with the account reason — needs you · action: give the three-part gateway change in Findings (blocked(gateway:ai:device-sign-in)) to a gateway agent; no CLI change is needed afterwards

## Open questions
- none
