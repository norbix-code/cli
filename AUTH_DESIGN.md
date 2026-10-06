# Auth & profiles design

Decided 2026-07-21. Implemented in v0.2.0 (profiles, sessions, configure).

## The model in one paragraph

A **profile** is a saved identity in one INI file, `~/.norbix/config`
(AWS-style, but one file instead of two — simpler, and the file is 0600
anyway). A **session** is what `norbix login` creates (user login today,
browser login later) and lives in `~/.norbix/session.json`. Without
`--profile`, a valid session wins and the `[default]` profile fills the gaps.
With `--profile <name>`, the CLI uses exactly that profile and ignores the
session — profiles are for scripts and precise identities.

## Files

```ini
# ~/.norbix/config  (mode 600 — secrets and settings together, on purpose)
[default]
api_key = nbk_live_...
project_id = 5f1a...

[fitskin-prod]
api_key = nbk_live_...
project_id = 64ff...
account_id = ...          # optional — for account-level commands
env = TEST                # optional — empty means PROD
region = nb-eu-germany    # optional
api_url = https://api.norbix.ai   # optional — override for self-hosted
hub_url = https://hub.norbix.ai   # optional
files_integration_id = ...        # optional
```

```jsonc
// ~/.norbix/session.json  (mode 600, machine-managed — do not edit)
{ "bearerToken": "...", "refreshToken": "...", "expiresAt": "...", "clientId": "norbix-cli",
  "method": "browser", "hubVersion": "v3", "projectId": "...", "userName": "...", "displayName": "..." }
```

Why sessions are a separate file even though config is merged: the config
file is edited by people and by `norbix configure`; sessions rotate on every
login and will be rewritten automatically by token refresh. Mixing them means
the tool constantly rewrites a hand-edited file.

## Resolution order

1. Command flags (`--project`, `--env`, `--api-key`, ...)
2. Environment variables (`NORBIX_PROFILE`, `NORBIX_API_KEY`, ...)
3. `--profile <name>` / `NORBIX_PROFILE` set → **that profile only**
   (session intentionally ignored)
4. Otherwise: valid session → `[default]` profile → legacy config.json
   (pre-profiles CLI versions)

`norbix whoami` always prints which profile and auth source won.

## Endpoints and the region rule

Defaults are `https://api.norbix.ai` and `https://hub.norbix.ai`. A region
turns them into `https://<region>.api.norbix.ai`.

**Rule:** `region`, `env` and `account_id` are optional in general — but when
a profile uses the DEFAULT endpoints, **region is required** (there is no
region-less norbix.ai endpoint). With custom `api_url`/`hub_url` (localhost,
self-hosted, custom domain) region is optional and URLs are never rewritten.
`norbix configure` enforces this (region prompt becomes required), and every
command checks it before making a request.

**Note:** the SDK's own built-in defaults still point at `.dev` — logged as
an SDK bug; the CLI always passes URLs explicitly, so it is not affected.

## Commands

- `norbix configure [--profile x]` — interactive, like `aws configure`:
  service-user API key (masked; ENTER keeps existing), project ID, optional
  account ID, optional environment (empty = PROD), optional region. Flags
  `--api-url` / `--hub-url` for self-hosted setups.
- `norbix profiles` — list profiles (keys redacted) + session state.
- `norbix login` — browser sign-in (an AI service user with the roles picked in the dashboard), or user+password with `--user`; writes the session.
  `norbix login --api-key ... --profile ci` writes a profile instead.
- `norbix logout` — revokes the refresh token on the Hub, removes the session; never touches profiles.
- `norbix env use X` — writes to the session when logged in, else to the
  profile.

## Phase 2 — browser sign-in (done)

`norbix login` (with no --user/--password) runs the OAuth 2.0 Device
Authorization Grant (RFC 8628): it prints a one-time code, opens the
dashboard on ENTER, polls until approved, and writes the session. The person
picks the roles on the dashboard page; the tokens belong to an **AI service
user** "Norbix CLI (<computer name>)" with exactly those roles, listed and
removed under Account → AI service users. When the Hub answers 404/405/501
the CLI prints a note that the Hub is older than the browser sign-in and
falls back to password login.

### Hub contract

The binding version is in the gateway: `docs/tasks/cli-browser-sign-in.md`
("Contract") and `docs/architecture/AI.OAuthConsent.md`. `{v}` is the Hub
version from `/echo` (`hubVersion`), never a fixed `v2`
(`src/lib/hub-version.ts`).

```
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
                                                 → exit 4 INVALID_GRANT / INVALID_REQUEST, the description shown
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

The access token lasts one hour, the refresh token 30 days and rotates on
every use. Before a call, when the access token has less than 60 s left, the
CLI refreshes it; a 401 triggers one refresh and one retry. The new pair and
its expiry are written in one step (a temporary file, then a rename). Before
refreshing, the CLI re-reads the session file: another terminal may already
have rotated the token. A dry run never refreshes. `src/lib/session-auth.ts`.

Why device-code over a Cursor-style localhost redirect: it works over SSH
(open the URL on any device), and it is one standard flow the backend
implements once.

## Phase 3

OS keychain (macOS Keychain / libsecret / Windows Credential Manager) as an
opt-in storage backend for `api_key` and tokens.
