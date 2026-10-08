# Hosts, discovery and one browser sign-in per Hub
This file: /Users/djovaisas/Projects/norbix/sdks/cli/docs/tasks/hosts-discovery.md (branch main, after the merge)

## Goal
The CLI only needs a host: the Hub tells it every address (Api, Hub, regions, sign-in URLs); config is AWS-style with a `host` per profile; browser sessions are stored per Hub; coding agents can sign in with a two-step browser flow.
Not in scope: changing the device sign-in itself on the Hub (kept as it is); the cloud image; deploying the new gateway and ingress to finlo (normal release path).

## Plan
1. [done] feat(hub:discovery): Hub serves GET /.well-known/norbix.json → {hubUrl}, license-gate open, tested (Hub.Surface 2001 passed, Api.Surface 302 passed) — gateway refactoringV2 4091dee42
2. [done] feat(devops:ingress): cloud host routes /.well-known/norbix.json to the Hub (hostinger template, k8s managed + self-hosted), hostinger README note — https://github.com/codemash-io/devops/pull/15
3. [done] feat(cli:hosts): `--host` / NORBIX_HOST / profile `host`; well-known → /echo discovery; cache per Hub in ~/.norbix/hosts for 24 h
4. [done] feat(cli:hosts): `--api-url` / `--hub-url` flags removed; profile api_url / hub_url and NORBIX_API_URL / NORBIX_HUB_URL still read for one release, with a deprecation warning
5. [done] feat(cli:sessions): browser sessions in ~/.norbix/sessions/<hub-host>.json; the old session.json is moved on first read; refresh writes back to the right file
6. [done] feat(cli:auth): credential order --api-key / NORBIX_API_KEY → profile api_key → browser session of the profile's host
7. [done] feat(cli:login): `login --host / --profile` signs in to that host; `login --api-key --host --profile` saves key + host
8. [done] feat(cli:login): SSH detection, `--no-browser`, and the agent two-step `--no-browser --json` then `--wait`
9. [done] feat(cli:logout): logout revokes all host sessions; `--host` / `--profile` only that host's session
10. [done] feat(cli:whoami): whoami shows host, Hub, Api, project, auth source; `profiles` lists signed-in hosts; `configure` asks for host; `config set/get/unset` know `host`
11. [done] docs(cli): README, AUTH_DESIGN.md, docs/AGENTS.md, agent-contract, login / logout / configure help, ai init agent rules; schema snapshot
12. [done] decision(hub:auth): the refresh token lifetime slides — every refresh gives a fresh 30 days; nothing to change
13. [done] feat(cli:region): the Hub tells a project's primary region, so --region is optional on norbix.ai when the caller may read the project
14. [doing] release(cli): pull request merged, minor release

## Changes
| file (absolute, branch feat/hosts-discovery) | what changed | step |
|------|--------------|------|
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/lib/hosts.ts | new: normalizeHost, discover (well-known → echo), resolveHost with cache / stale / built-in, regional endpoints, project region lookup + cache | 3, 13 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/lib/profiles.ts | `host` key; sessions per Hub; migration of session.json; pending sign-in files | 3, 5, 8 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/base.ts | global `--host`; discovery in `init`; `resolveContext` on hosts; credential order; deprecation warning; region from project; cache dropped on exit 7 | 3, 4, 6, 13 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/lib/session-auth.ts | refresher reads / writes the session file of its Hub | 5 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/lib/device-login.ts | SSH → no browser on every system; `pollDeviceTokenUntil` (90 s slices) | 8 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/commands/login.ts | host sign-in, `--no-browser`, `--wait`, `--api-key --host`; `--api-url` / `--hub-url` removed | 4, 7, 8 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/commands/logout.ts | all hosts, or one with `--host` / `--profile` | 9 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/commands/whoami.ts | host, Hub, Api lines | 10 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/commands/profiles.ts | signed-in hosts | 10 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/commands/configure.ts | asks for host; `--api-url` / `--hub-url` removed | 4, 10 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/commands/config/set.ts | `host` validated and normalized, removes api_url / hub_url (get / list / unset: no discovery) | 10 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/commands/env/use.ts | writes the session of the host's Hub | 5 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/lib/agent-files.ts | agent rules: two-step sign-in, `--host`, CI variables | 11 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/commands/ai/init.ts | closing text; no discovery (also schema.ts) | 11 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/lib/cli-error.ts | network hint names the host (also exit-codes.ts) | 11 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/test/hosts.test.ts | new: 30 tests — discovery, cache, credential order, region, migration, logout, refresh write-back | 3–9, 13 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/test/login.test.ts | rewritten: 21 tests — host sign-in, `--no-browser`, start / wait split | 7, 8 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/test/endpoints.test.ts | removed — replaced by test/hosts.test.ts | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/test/device-login.test.ts | SSH on darwin, linux, win32 | 8 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/test/seed.ts | new: the default host is "already discovered" in test homes | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/tests/_cli.ts | test profiles use `host`; the fake gateway answers discovery | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/tests/session-refresh.test.ts | sessions per Hub; NORBIX_HOST; deprecated variables warn | 4, 5 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/tests/config.test.ts | `config set host`, whoami host lines | 10 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/tests/ai-init.test.ts | agent rules carry the two steps | 11 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/tests/__snapshots__/schema.test.ts.snap | login: `no-browser`, `wait`; login / configure: no `api-url`, `hub-url` | 11 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/README.md | hosts, profiles, sessions, credential order, CI, agents | 11 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/AUTH_DESIGN.md | rewritten: Hosts and discovery, Profiles vs sessions, Credential order, Login, Logout, Agents, CI | 11 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/docs/AGENTS.md | sign-in section: the agent starts, the human approves (also docs/agent-contract.md) | 11 |

Tests: 807 before, 847 after (`npm test` = build + vitest, 29 files) — all pass.
Live check (read-only, empty HOME): `whoami --host hub.finlo.space --region nb-eu-germany` → Hub `https://nb-eu-germany.hub.finlo.space/v3`, Api `https://nb-eu-germany.api.finlo.space/v3`.

## Findings

decision(hub:auth): the refresh token lifetime slides — each rotation sets now + 30 days; no total limit — done (nothing to change)
    where: /Users/djovaisas/Projects/norbix/gateway/docs/tasks/well-known-discovery.md (branch refactoringV2)   ref: step 5 of the prompt
```csharp
// gateway src/Application.Layer/Commands/Account/AiOAuth/AiOAuthCommands.cs:569-571 (refactoringV2) — rotation
        var refreshToken = AiOAuthSecrets.NewToken();
        var rotated = await store.RotateRefreshTokenAsync(
            grant.Id, hash, AiOAuthSecrets.Hash(refreshToken), DateTime.UtcNow.Add(RefreshTokenLifetime), ct);   // <-- here: a fresh 30 days from this refresh
```

feat(cli:region): the Hub tells a project's primary region, so --region is optional on norbix.ai — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/lib/hosts.ts (fetchProjectRegion)   ref: step 2 of the prompt
```ts
// src/lib/hosts.ts — fetchProjectRegion (feat/hosts-discovery)
    const res = await fetchFn(`${hub.base}/${hub.version}/account/projects/${encodeURIComponent(projectId)}`, {
      headers,
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    })
    if (!res.ok) return undefined                        // <-- no project:read on the settings: old rule, --region
    const body = (await res.json()) as {item?: {primaryRegion?: {id?: unknown}}}
    const id = body.item?.primaryRegion?.id              // <-- gateway ProjectDto.PrimaryRegion.Id, e.g. nb-eu-germany
```
It needs `project:read` on the project settings; a service user without it still passes `--region`.

fix(cli:hosts): regional addresses from /echo have no version, the top-level ones do — handled — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/feat/hosts-discovery/src/base.ts (resolveContext)
```jsonc
// live https://hub.finlo.space/v3/echo
"hubUrl": "https://hub.finlo.space/v3",                              // <-- with /v3
"regions": [{"code": "nb-eu-germany", "apiUrl": "https://nb-eu-germany.api.finlo.space"}]   // <-- no version
```
The CLI takes the versions from the top-level URLs and lets the SDK add them; test `a region the Hub lists` in test/hosts.test.ts.

fix(cli:hosts): cloud.finlo.space answers its dashboard page for /.well-known/norbix.json today, so `--host cloud.finlo.space` stops with NOT_A_HUB until the new gateway and ingress are deployed there — todo (deploy)
    where: https://github.com/codemash-io/devops/pull/15
```text
$ curl -s -o /dev/null -w "%{http_code} %{content_type}" https://cloud.finlo.space/.well-known/norbix.json
200 text/html                                     <-- the SPA, not the Hub (ingress rule not applied yet)
```
The error hint then says: `pass the Hub instead, e.g. --host hub.finlo.space`. `--host hub.finlo.space` works now.

## Rejected / moved out
- decision(devops:ingress): k8s/ingress/enterprise, self-hosted/localhost.yaml and admin.yaml have no norbix-proof rule either, so no norbix.json rule was added there — rejected (same as norbix-proof) — new ticket: none
- decision(devops:compose): compose/self-hosted has no reverse proxy, so nothing to route — rejected
- chore(cli:main-checkout): main checkout /Users/djovaisas/Projects/norbix/sdks/cli is on fix/sdk-1.3-and-deps with an untracked docs/tasks/agent-native-cli.md — not mine, untouched
- chore(devops:main-checkout): main checkout /Users/djovaisas/Projects/norbix/devops has 3 changed files on main — not mine, untouched
- chore(gateway:main-checkout): main checkout /Users/djovaisas/Projects/norbix/gateway has an untracked docs/tasks/permissions-plan.md and 3 old stashes — not mine, untouched

## Needs you
- none

## Open questions
- none
