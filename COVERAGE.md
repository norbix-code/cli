# API endpoint coverage

Compared against the CodeMash docs (`docs/codemash-docs/api-reference`, 452
documented endpoints) on 2026-07-21.

**243 endpoints have a dedicated CLI command (the sum of the table below;
the line said 117 until the Project campaign, 2026-10-03, and had not kept
up with the push / SMS / Email rows). Every SDK method (~180 hub +
~40 api) is also callable with plain words:**

```sh
norbix hub database aggregates delete maggr_123 --schemaId sch_456
norbix hub scheduler tasks get --pageSize 100
```

And endpoints the SDK does not know yet are reachable with the raw escape
hatch (`norbix raw "/{version}/logs/settings"` — hub by default). Nothing is
out of reach.

## Coverage by doc group

| Group | Covered | Notes |
| --- | --- | --- |
| database/collections | 13/15 | find, find-one, count, insert, insert-many, update(+many), replace, delete(+many), distinct, aggregate, execute-aggregate. Missing: find-own, change-responsibility |
| database/schemas | 2/18 | read-only list/get. Schema editing is portal work |
| database/taxonomies | 2/15 | read-only list/get |
| database/aggregates | 1/5 | list only |
| files/* | 9/23 | upload, download, list, info, sign, delete. Missing: bulk delete, triggers, integration config |
| logs/* | 6/14 | list, trail, settings, module toggle. Missing: clean, integration config |
| membership/users | 6/35 | list, get, invite, block, unblock, delete. Missing: contacts, create-user variants, preferences |
| membership/roles + policies | 2/10 | read-only lists |
| notifications/email | 48/51 | every endpoint except the three recipient / provider callbacks — see `docs/email.md`; each command is run through the real transport in `tests/email-routes.test.ts` |
| notifications/push | 37/37 | every endpoint — see `docs/push.md`; each command is run through the real transport in `tests/push-routes.test.ts` |
| notifications/sms | 34/34 | every endpoint — see `docs/sms.md`; each command is run through the real transport in `tests/sms-routes.test.ts` |
| scheduler | 8/8 | every endpoint, `save` included (email-campaign task built from flags) — see `docs/scheduler.md`; each command is run through the real transport in `tests/scheduler-routes.test.ts`, with the exact `save` body |
| webhooks | 6/9 | show, secret, rotate, enable/disable/remove destination |
| payments | 7/16 | integrations list, triggers list/get/enable/disable, module toggle |
| account/* | 10/62 | profile, status, usage, projects, team, regions, billing-portal, api keys. Missing: team roles/policies management |
| account/projects (settings, CORS, admin portal, legal, AI chat) | 30/30 | every project route in `@norbix.ai/ts` 4.4.0 a developer calls (28 hub + the 2 public API-host reads) — see `docs/project.md`; each command is run through the real transport in `tests/project-routes.test.ts`. Not counted: create project, environments, notification groups/tags, AI plans/knowledge/credits (internal), expose brand/auth (next wave) |
| ai/integrations (LLM, MCP) | 15/20 | every LLM and MCP route — see `docs/ai.md`, same route test. Missing: the 5 embedding-integration routes (not asked for; `norbix hub ai …` reaches them) |
| account/ai/service-users | 5/5 | list, create, delete, rotate-key, revoke-key — see `docs/ai.md`, same route test |
| apikeys | 2/2 | list + regenerate |

Cross-cutting commands: `norbix integrations <module>` lists integrations for
9 modules; `norbix module enable|disable <name>` toggles 10 modules.

## Deliberately skipped (and why)

- **ai/integrations: embeddings (5)** — not asked for; the LLM and MCP
  integrations have commands since the Project campaign (`docs/ai.md`).
- **membership/passkeys-recovery (18)** — passkeys, magic links, password
  reset: end-user browser flows, not admin CLI actions.
- **account/verify, account/module create-account, team-member-from-invitation**
  — signup/onboarding flows that happen in the portal or email links.
- **webhooks/module receive-webhook** — inbound endpoint called by external
  services, not by a person.
- **save/config of integrations** (database, email, files, logging, payments,
  code, membership, AI) — large nested JSON configs; the portal validates
  them much better. Readable via `norbix integrations <module>`; writable via
  `norbix api` if ever needed.
- **code/marketplace (17)** — new surface; candidate for a future `norbix fx`
  topic (list/invoke marketplace function bindings could be very useful).
- **email preferences page, one-click unsubscribe, Mailgun webhook** — called
  by a recipient's browser, a recipient's mail client and Mailgun, never by a
  developer (`docs/email.md`, "No command on purpose").

## Version note

The CLI requires `@norbix.ai/ts` ^4.4.0, which has every push, SMS and Email
method; `push stop`, `sms stop` and `email stop` call the SDK directly. 4.4.0
dropped the campaign-message methods (the gateway removed
`GET /campaigns/{campaignId}/messages/{notificationId}`); `push campaign message`
and `sms campaign message` now read the same notification from the batch route.

## How this was measured

Doc file names (kebab-case) were converted to SDK method names (camelCase) and
matched against the methods the CLI actually calls. Regenerate with the same
approach after adding commands.
