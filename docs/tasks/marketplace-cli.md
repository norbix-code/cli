# Marketplace commands in the CLI (campaign audit/marketplace, item 7)
This file: /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/docs/tasks/marketplace-cli.md (branch audit/marketplace)

Where things are:
- CLI item worktree: /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace (branch audit/marketplace, from origin/main 02933f1)
- MCP item worktree: /Users/djovaisas/Projects/norbix/worktrees/norbix-mcp/audit/marketplace (branch audit/marketplace, from origin/main 001301d)
- Campaign root (read only): /Users/djovaisas/Projects/norbix/worktrees/gateway/audit/marketplace/campaign (branch audit/marketplace) — contract docs/architecture/Code.Marketplace.md §14 (23 routes), §16
- SDK used: @norbix.ai/ts 4.21.0 (released; tag v4.21.0 = a5873a3)

## Goal
`norbix code marketplace …` covers the marketplace routes a user needs (listings, connections, functions, runs) on the released `@norbix.ai/ts` 4.21.0, tested and documented; the MCP manifest follows the same SDK.
Not in scope: gateway / cloud / SDK changes; merging the pull requests; token-mapping, catalog, secret-reveal and token-list commands (reachable through `norbix hub code marketplace …`).

## Plan
1. [done] fix(cli:generated): bump @norbix.ai/ts to ^4.21.0 and regenerate src/generated/request-fields.json (652 methods, sdk 4.21.0)
2. [done] feat(cli:code:marketplace): listings, connections (list, get, enable, disable, delete, validate, secrets set), functions (list, get, add, enable, disable, delete, invoke), runs — 18 of the 23 routes
3. [done] test(cli:code:marketplace): 31 tests through oclif and the real SDK transport with fetch replaced; schema snapshot gains the 15 commands
4. [done] docs(cli:code:marketplace): docs/code.md section + recipe (Norbix Database → validate → db.find → invoke → runs), README row, COVERAGE.md line
5. [done] gen(mcp:manifest): manifest regenerated from the v4.21.0 SDK source (+1 endpoint, marketplace types), 3 new curated shortcuts, 6 new tests, README
6. [done] release(cli, mcp): rebased on origin/main, tests green, `nbx-ship --no-merge` — pull requests open, NOT merged (see Shipped in the report)

## Changes
| file (absolute, branch audit/marketplace) | what changed | step |
|------|--------------|------|
| /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/package.json | @norbix.ai/ts ^4.21.0; oclif topics `code marketplace`, `connections`, `connections secrets`, `functions` | 1, 2 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/package-lock.json | lock for 4.21.0 | 1 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/src/generated/request-fields.json | regenerated from 4.21.0 (`npm run gen:fields`) | 1 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/src/lib/marketplace.ts | new: key=value bags, arguments reader, `--input` parser, validation formatter and the add-functions gate | 2 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/src/commands/code/marketplace/ | new: listings.ts, runs.ts, connections/{list,get,enable,disable,delete,validate}.ts, connections/secrets/set.ts, functions/{list,get,add,enable,disable,delete,invoke}.ts | 2 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/tests/code-marketplace-routes.test.ts | new: 31 tests | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/tests/__snapshots__/schema.test.ts.snap | +200 lines (the 15 new commands), nothing removed | 3 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/docs/code.md | `norbix code marketplace` section + recipe | 4 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/README.md | command table row | 4 |
| /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/COVERAGE.md | marketplace no longer "candidate for a future topic": 18 of 23 routes have commands, 5 via `hub` | 4 |
| /Users/djovaisas/Projects/norbix/worktrees/norbix-mcp/audit/marketplace/package.json, package-lock.json | @norbix.ai/ts ^4.21.0 | 5 |
| /Users/djovaisas/Projects/norbix/worktrees/norbix-mcp/audit/marketplace/src/manifest/endpoints.json | +1 endpoint (GET /code/marketplace/functions/runs), 652 in all | 5 |
| /Users/djovaisas/Projects/norbix/worktrees/norbix-mcp/audit/marketplace/src/manifest/dtos.hub.json | +339 / -48: the marketplace types of the campaign (1561 Hub types) | 5 |
| /Users/djovaisas/Projects/norbix/worktrees/norbix-mcp/audit/marketplace/src/server.ts | curated `norbix_test_marketplace_integration`, `norbix_invoke_marketplace_function`, `norbix_get_marketplace_function_runs`; `norbix_save_marketplace_integration` explains the minted id | 5 |
| /Users/djovaisas/Projects/norbix/worktrees/norbix-mcp/audit/marketplace/tests/tools.test.ts, tests/__snapshots__/tools.test.ts.snap | 6 new tests; tool-list snapshot +3 tools | 5 |
| /Users/djovaisas/Projects/norbix/worktrees/norbix-mcp/audit/marketplace/README.md | shortcut list + a Marketplace paragraph | 5 |

## Findings

decision(cli:code:marketplace): `connections enable` has two shapes — `--listing ml_…` saves a new connection without an id and prints the minted `int_…` (the brief's "enable = save without an id"); a positional `int_…` turns a disabled connection back on (route 8), so `disable` keeps its partner — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/src/commands/code/marketplace/connections/enable.ts:38 (branch audit/marketplace)
```ts
// cli/src/commands/code/marketplace/connections/enable.ts:38-62 (audit/marketplace)
    if (Boolean(args.id) === Boolean(flags.listing)) {        // <-- exactly one of the two shapes
      throw usageError(
        'Pass either --listing (a new connection) or a connection ID (turn it back on), not both and not neither.',
    ...
    if (args.id) {
      const res = await client.hub.code.enableMarketplaceIntegration({integrationViewId: args.id})   // route 8
    ...
    const res = await client.hub.code.saveMarketplaceIntegration({   // route 4, viewId empty → server mints int_
```
```ts
// the test — cli/tests/code-marketplace-routes.test.ts (audit/marketplace)
    expect(calls[0]?.body).toEqual({
      integration: {listingViewId: 'ml_slack_v1', integrationName: 'Slack-support', isEnabled: true, config: {baseUrl: 'https://slack.com/api'}},
      secrets: {botToken: 'xoxb-1=2'},
    })                                                         // no viewId sent
    expect(out()).toContain(`Connection ${CONNECTION} created.`)
```

decision(cli:code:marketplace): `listings` takes an optional listing ID (route 2) so the recipe can show the install form, steps and function keys without leaving the topic; `--name` on enable defaults to the listing's displayName (one extra GET) — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/src/commands/code/marketplace/listings.ts (branch audit/marketplace)

decision(cli:code:marketplace): `functions add --arguments` sends a non-string JSON value as its JSON text, because the wire type of `arguments` is `string → string` and the family forms store filter / sort / projection as JSON text — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/src/lib/marketplace.ts:55 (branch audit/marketplace)
```ts
// cli/src/lib/marketplace.ts:52-56 (audit/marketplace)
    bag = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === null || value === undefined) continue
      bag[key] = typeof value === 'string' ? value : JSON.stringify(value)   // <-- {"status":"paid"} → '{"status":"paid"}', 20 → "20"
    }
```

decision(cli:code:marketplace): function get / enable / disable / delete take `--connection int_…` because those routes carry two path parameters (IntegrationViewId and FunctionViewId); invoke needs only the function id — done
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/src/commands/code/marketplace/functions/delete.ts (branch audit/marketplace)

fix(cli:code): `functions invoke` reuses the Code module's payload reader, whose refusal hint says "It becomes data.payload of the envelope" — wording from cloud functions, slightly off for a marketplace call; left as is (the refusal itself is right) — todo
    where: /Users/djovaisas/Projects/norbix/worktrees/cli/audit/marketplace/src/lib/code.ts:58 (branch audit/marketplace)
```ts
// cli/src/lib/code.ts:57-59 (audit/marketplace)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw usageError('The payload must be a JSON object.', `It becomes data.payload of the envelope, e.g. --payload '{"orderId":"…"}'.`)   // <-- here: Code wording
  }
```

chore(cli:session): while checking the plain-word commands in docs/code.md (`norbix hub code marketplace … --dry-run`), one run used the real CLI home, not a sandbox: the CLI adopted the account's only project into the saved sign-in — `"projectId": "pr_89W9MJvt0StwxsEvyohlJ"` added to ~/.norbix/sessions/hub.finlo.space.json — and two runs reached hub.finlo.space, which answered 400 `CM-ERRORS-GENERIC-029` to the made-up `--project p` before any marketplace request; nothing was created or revealed — done (reported, not undone)
    where: /Users/djovaisas/.norbix/sessions/hub.finlo.space.json

## Rejected / moved out
- decision(cli:code:marketplace): no dedicated commands for token mappings (route 12), secret reveal (11), function catalog (14) and the two token lists (3, 21) — rejected — they are reached with `norbix hub code marketplace …` (docs/code.md lists the exact words); a later item may add them — new ticket: none
- decision(cli:code:marketplace): no `--config` JSON form on `connections enable` (only repeated key=value) — rejected — every seeded config field is a flat string — new ticket: none
- chore(cli:main-checkout): the CLI main checkout on `fix/sdk-1.3-and-deps` with 1 changed file — not mine, untouched

## Needs you
- none

## Open questions
- none
