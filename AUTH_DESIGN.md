# Auth, hosts & profiles design

Decided 2026-07-21 (profiles, sessions). Hosts, discovery and one sign-in
per Hub: 2026-10-08 (CLI 1.19). Task file: `docs/tasks/hosts-discovery.md`.

## The model in one paragraph

The CLI needs exactly one address: a **host** (your Norbix dashboard or Hub,
default `hub.norbix.ai`). The Hub decides every other address (Api, Hub,
regions, sign-in URLs). A **profile** is a saved identity in one INI file,
`~/.norbix/config` (AWS-style). A **session** is what a browser sign-in
creates, one per Hub, in `~/.norbix/sessions/<hub-host>.json`. A profile
with an `api_key` uses it; a profile without one uses the browser sign-in
of its host.

## Hosts and discovery

Where the host comes from (first wins): `--host` → `NORBIX_HOST` → the
profile's `host` → (deprecated, one release) `hub_url` / `api_url` in the
profile, `NORBIX_HUB_URL` / `NORBIX_API_URL` → `hub.norbix.ai`.

A host is written bare (`cloud.example.com`) or as a URL. It is https by
default; plain http is accepted only for `localhost`, `127.0.0.1`, `::1`
and `*.localhost`, so `--host localhost:5001` works for local development.

```
host                     GET https://<host>/.well-known/norbix.json
  │                        → {"hubUrl": "https://hub.example.com/v3"}
  │                        404, not JSON, no hubUrl, or plain http to a server
  │                        → <host> itself is the Hub
  ▼
Hub                      GET <hubUrl>/echo
                           → hubUrl, apiUrl (both with /vN), hubVersion,
                             apiVersion, regions[] {code, apiUrl, hubUrl}
                             (regional URLs have no version), agent.device*Url
```

`/.well-known/norbix.json` is served by the Hub (anonymous, `Cache-Control:
public, max-age=300`, license-gate exempt — gateway
`Heartbeat/NorbixDiscovery.cs`). On a cloud host the ingress sends that one
path to the Hub, next to `/.well-known/norbix-proof` (devops
`terraform/hostinger/scripts/ingress.yaml.tftpl`, `k8s/ingress/*`).

The answer is cached per Hub in `~/.norbix/hosts/<hub-host>.json` (mode 600)
for 24 hours; `~/.norbix/hosts/aliases.json` remembers which Hub a host led
to, so `cloud.example.com` and `hub.example.com` share one cache file and one
sign-in. When a command fails with a network error (exit 7), the cached
answer is dropped and the next command discovers again. When a host cannot
be reached, an old cached answer is used; for `hub.norbix.ai` with nothing
cached, the built-in `https://api.norbix.ai` / `https://hub.norbix.ai`.

Discovery runs before a command (`BaseCommand.init`). Commands that never
reach a server (`config`, `configure`, `profiles`, `schema`, `ai init`, a
`login --api-key`, a `logout` of everything) do not discover.

**Region.** When a region is set and the Hub lists it, the region's own
addresses are used. On norbix.ai a region is required; when none is set and
the CLI is authenticated, it asks the Hub for the project's primary region
once (`GET /{v}/account/projects/{id}` → `item.primaryRegion.id`, needs
`project:read` on the project settings) and caches it for 7 days in
`~/.norbix/hosts/<hub-host>.regions.json`. If the Hub refuses, the old rule
applies: pass `--region`.

## Profiles vs sessions

```ini
# ~/.norbix/config (mode 600, written by people and `norbix configure`)
[default]                 # no host = hub.norbix.ai
project_id = ...

[finlo]
host = cloud.finlo.space
project_id = ...

[finlo-ci]
host = hub.finlo.space
api_key = nbsu_...
project_id = ...
```

Other keys: `account_id`, `env` (empty = PROD), `region`, `hub_version`
(override), `files_integration_id`. `api_url` / `hub_url` still work for one
release and print a deprecation warning on stderr; `config set host` and
`login --api-key --host` remove them.

```jsonc
// ~/.norbix/sessions/hub.finlo.space.json  (mode 600, machine-managed)
{ "bearerToken": "...", "refreshToken": "...", "expiresAt": "...", "clientId": "norbix-cli",
  "method": "browser", "hubUrl": "https://hub.finlo.space", "hubVersion": "v3",
  "host": "cloud.finlo.space", "projectId": "...", "userName": "...", "displayName": "..." }
```

Sessions are separate files because they rotate on every refresh; the
config file is edited by people. The session stores the Hub that issued the
token, so refresh and revoke reach it without discovery. The one file of
CLI 1.18 and older, `~/.norbix/session.json`, is moved to
`sessions/<its hub>.json` on first read (its `hubUrl`, else `hub.norbix.ai`);
it never overwrites a newer sign-in.

## Credential order

1. `--api-key` / `NORBIX_API_KEY`
2. the profile's `api_key` (`--profile` / `NORBIX_PROFILE`, else `[default]`)
3. the browser session of the profile's host's Hub
4. the old per-OS `config.json` (CLI 0.1; not with an explicit `--profile`)

A profile is only used for its own host: with `--host` for another Hub the
`[default]` profile is left out (its key is never sent to another host), and
an explicit `--profile` for another host is a usage error.

Other values (`project_id`, `account_id`, `env`, `region`): flags /
`NORBIX_*` → profile → session → old config.json. `norbix whoami` prints the
host, Hub, Api, profile and auth source that won.

## Login

- `norbix login [--profile p | --host h]` — browser sign-in (RFC 8628) to
  that host's Hub. The person approves on `<cloud>/device` and picks the
  roles; the CLI becomes the AI service user "Norbix CLI (<computer>)".
- `norbix login --api-key ... [--host h] --profile p` — saves key and host
  in the profile. No network.
- Over SSH (`SSH_CONNECTION`, `SSH_CLIENT` or `SSH_TTY` set — on every
  system: `open` on a Mac reached by SSH opens the browser on that Mac),
  without a desktop, or with `--no-browser`, the CLI never opens a browser:
  it prints the link and waits.
- No terminal and none of `--api-key`, `--no-browser`, `--wait` → exit 2;
  the hint names `--no-browser`.

## Logout

`norbix logout` revokes (RFC 7009) and removes every host's sign-in, and any
pending agent sign-in. `logout --host h` / `logout --profile p` does it for
that host's Hub only. Logout never touches profiles.

## Agents

A coding agent's shell commands time out after about 2 minutes; the device
code lives 10 minutes. So the agent signs in in two steps:

1. `norbix login --no-browser --json` starts the device flow, saves the
   pending code in `~/.norbix/sessions/<hub-host>.pending.json` (mode 600)
   and prints `{status: "pending", userCode, verificationUri,
   verificationUriComplete, expiresIn, next}` — then exits 0 at once.
   The agent shows the link and the code to the person.
2. `norbix login --wait` polls the saved code for at most 90 s. Approved →
   the session is saved, the pending file removed, exit 0. Still pending →
   exit 4 `AUTHORIZATION_PENDING` (run it again). Denied / expired /
   refused → exit 4 `ACCESS_DENIED` / `EXPIRED_TOKEN` / `INVALID_GRANT`, the
   pending file removed (start over). A `slow_down` is saved for the next run.

`norbix ai init` writes these rules into the agent files.

## CI

CI never signs in through a browser: `NORBIX_HOST` + `NORBIX_API_KEY` +
`NORBIX_PROJECT_ID` (plus `NORBIX_REGION` on norbix.ai when the key cannot
read the project's region), or a profile written by `login --api-key`.

## Hub contract

`{v}` is the Hub version from `/echo` (`hubVersion`), never a fixed `v2`.
The binding version is in the gateway: `docs/tasks/cli-browser-sign-in.md`
and `docs/architecture/AI.OAuthConsent.md`.

```
GET  /.well-known/norbix.json          (anonymous) → { hubUrl }
GET  /{v}/echo                         (anonymous) → addresses, versions, regions

POST /{v}/auth/device/start            (anonymous)
  body:     { clientName: "norbix-cli", deviceName?, projectId? }
  response: { deviceCode, userCode, verificationUri,
              verificationUriComplete, expiresIn: 600, interval: 5 }

POST /{v}/auth/device/token            (anonymous, always HTTP 200)
  body:     { deviceCode }
  pending:  { error: "authorization_pending" }   → poll again
  slower:   { error: "slow_down" }               → CLI adds 5 s to the interval
  denied:   { error: "access_denied" }           → exit 4 ACCESS_DENIED
  expired:  { error: "expired_token" }           → exit 4 EXPIRED_TOKEN
  refused:  { error: "invalid_grant" | "invalid_request", errorDescription? }
  success:  { bearerToken, refreshToken, expiresIn, clientId, userId,
              userName, displayName, accountId, projectId? }

POST /{v}/oauth/token                  (form)
  grant_type=refresh_token & refresh_token & client_id
  → { access_token, expires_in, refresh_token (rotated), ... }
  → 400 { error: "invalid_grant" }               → tokens cleared, exit 4 SESSION_EXPIRED

POST /{v}/oauth/revoke                 (form, RFC 7009; `norbix logout`)
  token & token_type_hint=refresh_token & client_id → 200 {}
```

### Refresh

The access token lasts one hour. The refresh token lasts 30 days and rotates
on every use; each rotation gets a fresh 30 days (sliding — gateway
`AiOAuthCommands.cs`, `RotateRefreshTokenAsync(..., DateTime.UtcNow.Add(RefreshTokenLifetime))`),
so a CLI used at least once a month stays signed in. Reusing an old refresh
token ends the whole grant. Before a call, when the access token has less
than 60 s left, the CLI refreshes it; a 401 triggers one refresh and one
retry. The new pair is written to that Hub's session file in one step (a
temporary file, then a rename), after re-reading it: another terminal may
already have rotated the token. A dry run never refreshes.
`src/lib/session-auth.ts`.

## Later

OS keychain (macOS Keychain / libsecret / Windows Credential Manager) as an
opt-in storage backend for `api_key` and tokens.
