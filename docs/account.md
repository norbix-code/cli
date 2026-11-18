# `norbix account`

Account-level commands: the organisation, its projects and its team. All
paths below are under `/{version}/account` on the Hub host.

`account team`, `account me`, `account me set-phone`, `account regions`,
`account bundles`, `account change-bundle`, `account clusters`,
`account clusters upgrade`, `account discount check` and
`account discount apply` are run through the
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
| `norbix account discount check <code> [--bundle <starter\|growth\|scale>] [--period <monthly\|annual>]` | check a discount code and say what it gives; changes nothing | `POST /stripe/discount/check` |
| `norbix account discount apply <code> [--yes] [--dry-run]` | put a discount code on the running bundle subscription | `POST /stripe/discount` |
| `norbix account clusters` | list the account's Norbix-managed Atlas clusters | `GET /flex-clusters` |
| `norbix account clusters upgrade <flexClusterId> [--tier <code>] [--yes] [--dry-run]` | queue the upgrade of one cluster one tier up (FLEX → M10 → M20 → M30 → M40, within the plan) | `POST /flex-clusters/{flexClusterId}/upgrade` |

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
`--period` are needed, also when only one of them changes. The change is sent
to Stripe and the account follows when Stripe has confirmed it, so
`account status` can show the old bundle for a short time.

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

## Discount codes

`account discount check <code>` asks the gateway what a code gives and changes
nothing. `--bundle` and `--period` are the plan about to be bought; without
them the code is checked against the account's current plan. It prints one
line, for example `LAUNCH30: 30% off for 3 months`; `--json` prints the whole
answer (`discount`: `code`, `percentOff`, `amountOff` in minor units with
`currency`, `months` — empty means forever — and `endsAt`).

`account discount apply <code>` puts the code on the account's running
subscription. It changes what the account pays, so it asks first like
`change-bundle` (`--yes`, `--dry-run`). The discount reaches
`account status` (`discount`) when Stripe has confirmed it. An account with no
subscription is refused with `CM-ERRORS-PROJECTS-039`. A new subscription
takes its code at checkout, in Cloud; the CLI starts no checkout.

A code that cannot be used is refused with `CM-ERRORS-ACCOUNT-027` (exit 6).
The hint says what the reason means; with `--json` the reason is in
`error.context.reason`: `not_found`, `not_started`, `expired`,
`not_for_bundle`, `monthly_only`, `wrong_billing_period`,
`already_has_discount` or `already_used`.

```bash
norbix account discount check LAUNCH30 --bundle growth --period monthly
norbix account discount apply LAUNCH30 --dry-run
norbix account discount apply LAUNCH30 --yes
```

## Norbix-managed Atlas clusters

`account clusters` lists the Atlas clusters Norbix runs for the account. One
cluster can hold the databases of several projects and environments.

```
ID        NAME    REGION         TIER  NEXT  STATUS  DATABASES  NEAR LIMIT
fxc_1a2b  Shared  nb-eu-germany  FLEX  M10   Active  3          Storage
fxc_3c4d  Shop    nb-eu-germany  M10   M20   Active  1          -
```

- TIER is `FLEX`, `M10`, `M20`, `M30` or `M40`; NEXT is the tier `account clusters upgrade` moves it to (`-` when the cluster is at the highest tier its plan allows); STATUS is `Empty`, `Provisioning`, `Active` or `Failed`.
- NEAR LIMIT names the limits the cluster is close to (`Databases`, `Storage`, `Connections`, `Operations`); `-` means none.
- When the account cannot create one more cluster, a last line says why (a
  trial account has one cluster; or the account's cluster limit is reached).
- `--json` prints the whole answer: `canCreateNew`, `cannotCreateReason`, and
  for every cluster its `databases` (project, environment, integration,
  database name) and its `usage` (database count, storage bytes, connections,
  operations per second).

`account clusters upgrade <flexClusterId>` moves one cluster one tier up on
the ladder FLEX → M10 → M20 → M30 → M40, within the plan: a trial stays on
FLEX, Starter goes up to M20, Growth up to M30, Scale up to M40. Without
`--tier` the cluster moves to its next tier (NEXT); a cluster already at its
plan's top is refused (`CM-ERRORS-DATABASE-068`). `--tier` must name that
same next step — the gateway refuses any other tier. Every database on the
cluster moves with it and the price of the cluster changes, so the command
asks first (`--yes`, `--dry-run`, as above). The upgrade is queued:
`account clusters` shows the new tier some minutes later.

```bash
norbix account clusters
norbix account clusters --json
norbix account clusters upgrade fxc_2ToIiRM03X63TZaJ2dJdv2 --tier M20 --dry-run
norbix account clusters upgrade fxc_2ToIiRM03X63TZaJ2dJdv2 --yes
```

There is no named command that saves a Norbix-managed database integration,
creates a project or creates an environment, so the CLI has no
`--flex-cluster-id` / `--cluster-name` flags. A new database is placed on a
cluster in the dashboard (see "No command on purpose" in
[database.md](database.md)). The generic call sends the body as written, so
the two fields `flexClusterId` (reuse that cluster) and `clusterDisplayName`
(name of a new cluster) can go in the `integration` object of
`norbix hub database integration save --body '<json>'`; send one of them, not
both.
