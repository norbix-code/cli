# `norbix account`

Account-level commands: the organisation, its projects and its team. All
paths below are under `/{version}/account` on the Hub host.

`account team` is run through the
real SDK with `fetch` replaced in `tests/account-routes.test.ts` (verb, path,
query string, body); `tests/account.test.ts` checks the SDK method and fields.

| command | what it does | endpoint |
|---|---|---|
| `norbix account profile` | show the organisation's profile | `GET /profile` |
| `norbix account status` | show the account status | `GET /status` |
| `norbix account usage` | show the account usage and billing | `GET /usage-billing` |
| `norbix account projects` | list the projects | `GET /projects` |
| `norbix account regions` | list the regions the account may use | `GET /regions` |
| `norbix account billing-portal` | get the billing portal link | `POST /stripe/get-portal-url` |
| `norbix account team [--in-project <id>] [--include-owner] [--page-size <n>] [--after <cursor>] [--before <cursor>]` | list the team members (collaborators) | `GET /collaborators` |

`account team` pages with `--page-size` (server default 20) and the
`--after` / `--before` cursors, sent as the flat `pageSize`, `startingAfter`,
`endingBefore` fields (`@norbix.ai/ts` 4.8.0; the gateway no longer reads the
nested `pagingArgs`). `--in-project` keeps only the members with access to
that project; it is a filter, separate from the global `--project` context, so
`NORBIX_PROJECT_ID` never narrows the list on its own. The account owner is
left out unless `--include-owner` is set.

```bash
norbix account team --include-owner --page-size 50
```
