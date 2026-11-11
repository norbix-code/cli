# `norbix account`

Account-level commands: the organisation, its projects and its team. All
paths below are under `/{version}/account` on the Hub host.

`account team`, `account me`, `account me set-phone`, `account regions`,
`account bundles`, `account change-bundle`, `account clusters` and
`account clusters upgrade` are run through the
real SDK with `fetch` replaced in `tests/account-routes.test.ts` (verb, path,
query string, body); `tests/account.test.ts` checks the SDK method and fields.

| command | what it does | endpoint |
|---|---|---|
| `norbix account profile` | show the organisation's profile | `GET /profile` |
| `norbix account status` | show the account status | `GET /status` |
| `norbix account usage` | show the account usage and billing, then a table of workflow months (period, runs, step runs): counted, not billed | `GET /usage-billing` |
| `norbix account projects` | list the projects | `GET /projects` |
| `norbix account regions` | list the regions the account may use — needs no login and no project | `GET /regions` |
| `norbix account billing-portal` | get the billing portal link | `POST /stripe/get-portal-url` |
| `norbix account team [--in-project <id>] [--include-owner] [--page-size <n>] [--after <cursor>] [--before <cursor>]` | list the team members (collaborators) | `GET /collaborators` |
| `norbix account me` | show your own team-member record (owner or member) — not the organisation's profile | `GET /me` |
| `norbix account me set-phone <phone>` / `--clear` | save (E.164, `+37060000000`) or clear your own phone | `PUT /me/phone` |
| `norbix account bundles` | list the Managed Service bundles: name, project limit, monthly and annual price | `GET /stripe/bundles` |
| `norbix account change-bundle --bundle <starter\|growth\|scale> --period <monthly\|annual> [--yes] [--dry-run]` | move the account to another bundle or billing period | `POST /stripe/change-bundle` |
| `norbix account clusters` | list the account's Norbix-managed Atlas clusters | `GET /flex-clusters` |
| `norbix account clusters upgrade <flexClusterId> [--yes] [--dry-run]` | queue the upgrade of one cluster to M10 | `POST /flex-clusters/{flexClusterId}/upgrade` |

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

## Bundles

The Managed Service is sold as three bundles — Starter, Growth, Scale. A
bundle sets how many enabled projects the account may have. `account bundles`
prints them; the amount comes from the server in minor units (5900 = 59.00)
and the table shows it as money with the currency in upper case. `--json`
prints the answer as the server sent it.

```
BUNDLE   PROJECTS  MONTHLY     ANNUAL
Starter  3         59.00 USD   590.00 USD
Growth   10        149.00 USD  1490.00 USD
Scale    30        399.00 USD  3990.00 USD
```

(The numbers above are an example; the command prints the real ones.)

`account change-bundle` moves the account to another bundle or billing
period. It changes what the account pays, so it asks first: `--yes` skips the
question, a shell with no terminal and no `--yes` exits 3 and sends nothing,
`--dry-run` prints the request and sends nothing. Both `--bundle` and
`--period` are needed, also when only one of them changes.

A bundle that allows fewer enabled projects than the account has now is
refused with `CM-ERRORS-ACCOUNT-023` (exit 6). The CLI prints the server's
message — it says how many projects to turn off — and the hint names the
command: `norbix project disable --project <id> --yes`. With `--json` the
numbers are in `error.context` (`enabledProjects`, `projectCap`, `bundle`).

`account status` prints the whole status, so it shows the new fields with no
change: `bundle`, `billingPeriod`, `isTrial`, `renewsOn`, `enabledProjects`
and `projectCap`.

```bash
norbix account bundles
norbix account change-bundle --bundle growth --period annual --dry-run
norbix account change-bundle --bundle growth --period annual --yes
```

## Norbix-managed Atlas clusters

`account clusters` lists the Atlas clusters Norbix runs for the account. One
cluster can hold the databases of several projects and environments.

```
ID         NAME    REGION         TIER  STATUS  DATABASES  NEAR LIMIT
fxc_1a2b   Shared  nb-eu-germany  FLEX  Active  3          Storage
fxc_3c4d   Shop    nb-eu-germany  M10   Active  1          -
```

- TIER is `FLEX` or `M10`; STATUS is `Empty`, `Provisioning`, `Active` or `Failed`.
- NEAR LIMIT names the limits the cluster is close to (`Databases`, `Storage`, `Connections`, `Operations`); `-` means none.
- When the account cannot create one more cluster, a last line says why (a
  trial account has one cluster; or the account's cluster limit is reached).
- `--json` prints the whole answer: `canCreateNew`, `cannotCreateReason`, and
  for every cluster its `databases` (project, environment, integration,
  database name) and its `usage` (database count, storage bytes, connections,
  operations per second).

`account clusters upgrade <flexClusterId>` moves one cluster to M10. Every
database on the cluster moves with it and the price of the cluster changes,
so the command asks first (`--yes`, `--dry-run`, as above). The upgrade is
queued: `account clusters` shows `M10` some minutes later.

```bash
norbix account clusters
norbix account clusters --json
norbix account clusters upgrade fxc_2ToIiRM03X63TZaJ2dJdv2 --dry-run
norbix account clusters upgrade fxc_2ToIiRM03X63TZaJ2dJdv2 --yes
```

There is no command that creates a Norbix-managed database, so the CLI has no
`--flex-cluster-id` / `--cluster-name` flags: choosing a cluster for a new
database is done in the dashboard (see "No command on purpose" in
[database.md](database.md)).
