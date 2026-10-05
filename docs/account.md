# `norbix account`

Account-level commands: the organisation, its projects and its team. All
paths below are under `/{version}/account` on the Hub host.

`account team`, `account me`, `account me set-phone` and `account regions` are run through the
real SDK with `fetch` replaced in `tests/account-routes.test.ts` (verb, path,
query string, body); `tests/account.test.ts` checks the SDK method and fields.

| command | what it does | endpoint |
|---|---|---|
| `norbix account profile` | show the organisation's profile | `GET /profile` |
| `norbix account status` | show the account status | `GET /status` |
| `norbix account usage` | show the account usage and billing | `GET /usage-billing` |
| `norbix account projects` | list the projects | `GET /projects` |
| `norbix account regions` | list the regions the account may use — needs no login and no project | `GET /regions` |
| `norbix account billing-portal` | get the billing portal link | `POST /stripe/get-portal-url` |
| `norbix account team [--in-project <id>] [--include-owner] [--page-size <n>] [--after <cursor>] [--before <cursor>]` | list the team members (collaborators) | `GET /collaborators` |
| `norbix account me` | show your own team-member record (owner or member) — not the organisation's profile | `GET /me` |
| `norbix account me set-phone <phone>` / `--clear` | save (E.164, `+37060000000`) or clear your own phone | `PUT /me/phone` |

`account team` pages with `--page-size` (server default 20) and the
`--after` / `--before` cursors, sent as the flat `pageSize`, `startingAfter`,
`endingBefore` fields (`@norbix.ai/ts` 4.8.0; the gateway no longer reads the
nested `pagingArgs`). `--in-project` keeps only the members with access to
that project; it is a filter, separate from the global `--project` context, so
`NORBIX_PROJECT_ID` never narrows the list on its own. The account owner is
left out unless `--include-owner` is set.

The phone from `account me set-phone` is where "Account users" SMS campaigns
send (`norbix sms campaign create --audience account-users --user <id>`, ids
from `account team`); a member without a phone is skipped.

```bash
norbix account team --include-owner --page-size 50
norbix account me --json
norbix account me set-phone +37060000000
norbix account me set-phone --clear
```
