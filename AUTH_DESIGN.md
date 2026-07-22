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
{ "bearerToken": "...", "refreshToken": "...", "projectId": "...", "userName": "..." }
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
- `norbix login` — user+password today, writes the session.
  `norbix login --api-key ... --profile ci` writes a profile instead.
- `norbix logout` — removes the session only; never touches profiles.
- `norbix env use X` — writes to the session when logged in, else to the
  profile.

## Phase 2 — browser login (CLI DONE — hub endpoints to implement)

The CLI side is implemented: `norbix login` (with no --user/--password) runs
the OAuth 2.0 Device Authorization Grant (RFC 8628) — prints a one-time code,
opens the browser on ENTER, polls until approved, writes the session. When
the hub answers 404/405/501 it falls back to password login automatically,
so this ships safely before the backend exists.

### Hub endpoint contract (for the backend team)

```
POST /v2/auth/device/start
  body:     { clientName: "norbix-cli", projectId?: string }
  response: { deviceCode, userCode, verificationUri,
              verificationUriComplete?, expiresIn?: 600, interval?: 5 }

POST /v2/auth/device/token
  body:     { deviceCode }
  pending:  HTTP 428  (or 200 + { error: "authorization_pending" })
  slower:   { error: "slow_down" }        → CLI adds 5s to poll interval
  denied:   { error: "access_denied" }    → CLI aborts
  expired:  { error: "expired_token" }    → CLI asks to run login again
  success:  { bearerToken, refreshToken?, userId?, userName?,
              displayName?, projectId?, accountId? }
```

`verificationUri` should be a hub page (e.g. hub.norbix.ai/activate) where a
logged-in user types the userCode and approves. Suggested lifetimes: ~1h
bearer + ~30d refresh; `norbix logout` should revoke the refresh token
server-side (future). Why device-code over Cursor-style localhost redirect:
works over SSH (open the URL on any device), and it is one standard flow the
backend implements once; the localhost redirect can be added later as a
desktop nicety.

## Phase 3

OS keychain (macOS Keychain / libsecret / Windows Credential Manager) as an
opt-in storage backend for `api_key` and tokens.
