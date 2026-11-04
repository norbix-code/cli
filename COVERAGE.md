# API endpoint coverage

Compared against the CodeMash docs (`docs/codemash-docs/api-reference`, 452
documented endpoints) on 2026-07-21.

**349 endpoints have a dedicated CLI command (the sum of the table below;
the line said 117 until the Project campaign, 2026-10-03, 287 until the
integrations campaign, 2026-11-03, which added the files / code / logs /
membership integration commands and quick connect, and 325 until the triggers
campaign, 2026-11-04, which added the files / membership / AI trigger commands
and the shared trigger routes). Every SDK method (~180 hub +
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
| files/* | 23/24 | upload, download, list, info, sign, delete; the 8 integration routes (list, get, save, test, enable, disable, default, delete) — `docs/integrations.md`, `tests/files-integration-routes.test.ts`; the 6 trigger routes (list, get, save, enable, disable, delete) — `docs/triggers.md`, each run through the real transport in `tests/files-trigger-routes.test.ts`. Missing: bulk delete |
| logs/* | 16/16 | list, trail, get, settings, settings set, clean, write (Api host), module toggle — each command is run through the real transport in `tests/logs.test.ts`; the 7 integration routes (list, get, save, test, enable, disable, delete) — `docs/integrations.md`, `tests/logs-integration-routes.test.ts` |
| membership/users | 6/35 | list, get, invite, block, unblock, delete. Missing: contacts, create-user variants, preferences |
| membership/roles + policies | 2/10 | read-only lists |
| membership/integrations (sign-in providers) | 7/7 | list, get, save, enable, disable, default, delete — `docs/integrations.md`, `tests/membership-integration-routes.test.ts` |
| membership/triggers | 6/6 | list, get, save, enable, disable, delete — `docs/triggers.md`, each run through the real transport in `tests/membership-trigger-routes.test.ts` |
| code/integrations | 8/8 | list, get, save, test, confirm-delivery, enable, disable, delete — `docs/integrations.md`, `tests/code-integration-routes.test.ts` |
| notifications/email | 48/51 | every endpoint except the three recipient / provider callbacks — see `docs/email.md`; each command is run through the real transport in `tests/email-routes.test.ts` |
| notifications/push | 37/37 | every endpoint — see `docs/push.md`; each command is run through the real transport in `tests/push-routes.test.ts` |
| notifications/sms | 34/34 | every endpoint — see `docs/sms.md`; each command is run through the real transport in `tests/sms-routes.test.ts` |
| scheduler | 8/8 | every endpoint, `save` included (email-campaign task built from flags) — see `docs/scheduler.md`; each command is run through the real transport in `tests/scheduler-routes.test.ts`, with the exact `save` body |
| webhooks | 6/9 | show, secret, rotate, enable/disable/remove destination |
| payments | 26/26 | every endpoint a person calls (the inbound provider webhook is called by the provider), the three quick-connect routes included (they are in the gateway's `[Route]` list but not in the manifest) — see `docs/payments.md`; each command is run through the real transport in `tests/payments-routes.test.ts`, the quick-connect bodies in `tests/integrations-connect.test.ts` |
| integrations/connect (shared quick-connect routes) | 2/4 | providers, targets — `docs/integrations.md`, `tests/integrations-connect.test.ts`. Not commands: the provider callback and the dev-fake authorize page |
| account/* | 12/64 | profile, status, usage, projects, team (paging + project / owner filters), regions, billing-portal, api keys, me, me set-phone — see `docs/account.md`; team / me / set-phone run through the real transport in `tests/account-routes.test.ts`. Missing: team roles/policies management |
| account/projects (settings, CORS, admin portal, legal, AI chat) | 30/30 | every project route in `@norbix.ai/ts` 4.4.0 a developer calls (28 hub + the 2 public API-host reads) — see `docs/project.md`; each command is run through the real transport in `tests/project-routes.test.ts`. Not counted: create project, environments, notification groups/tags, AI plans/knowledge/credits (internal), expose brand/auth (next wave) |
| ai/integrations (LLM, MCP) | 15/20 | every LLM and MCP route — see `docs/ai.md`, same route test. Missing: the 5 embedding-integration routes (not asked for; `norbix hub ai …` reaches them) |
| account/ai/service-users | 5/5 | list, create, delete, rotate-key, revoke-key — see `docs/ai.md`, same route test |
| ai/triggers | 6/6 | list, get, save, enable, disable, delete — `docs/triggers.md`, each run through the real transport in `tests/ai-trigger-routes.test.ts` |
| triggers (shared, any host) | 6/6 | runs, run, attention, definition, pre-execute-code test, execution-identity check — `docs/triggers.md`; `tests/trigger-runs-routes.test.ts` and `tests/trigger-shared-routes.test.ts`. (The manifest misses these routes — emitter bug; they are in the gateway's `[Route]` list) |
| apikeys | 2/2 | list + regenerate |
| code/workflows (beta) | 26/30 | every route a person calls (24 Hub + the Api host's waiting list and resume) — see `docs/code.md`; each command is run through the real transport in `tests/code-workflows-routes.test.ts`. Not commands: the four signed resume-link routes (`GET`/`POST /code/workflows/resume/{token}`, Hub and Api), opened by an approver's browser from an e-mail |

Cross-cutting commands: `norbix integrations <module>` lists integrations for
9 modules; `norbix module enable|disable <name>` toggles 10 modules.
`norbix integrations keyless-setup <module> <cloud>` covers
`GET /integrations/keyless/setup` for every module the gateway serves (files, email,
code, logs, push, payments, database), `--template <kind>` included
(tests/integrations-keyless-setup.test.ts).

## Deliberately skipped (and why)

- **ai/integrations: embeddings (5)** — not asked for; the LLM and MCP
  integrations have commands since the Project campaign (`docs/ai.md`).
- **membership/passkeys-recovery (18)** — passkeys, magic links, password
  reset: end-user browser flows, not admin CLI actions. Exception: the admin
  route `POST /membership/userauth/password/reset/test` is covered by
  `norbix membership password reset request` (gateway N45: test the reset
  e-mail and see which integration sent it).
- **account/verify, account/module create-account, team-member-from-invitation**
  — signup/onboarding flows that happen in the portal or email links.
- **webhooks/module receive-webhook** — inbound endpoint called by external
  services, not by a person.
- **save/config of database integrations** — large nested JSON configs; the
  portal validates them much better. Readable via `norbix db integrations`;
  writable via `norbix hub database …` if ever needed. (Email, push, SMS,
  payments, AI, files, code, logging and membership integrations have `save`
  commands: the provider fields travel in `--config`.)
- **code/marketplace token mappings, function catalog, secret reveal, token
  lists (5 of 23)** — the other 18 marketplace routes have commands under
  `norbix code marketplace` (`docs/code.md`); these five are reached with
  `norbix hub code marketplace …`.
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

- **membership/execution-identities (2)** — `identities list`, `identities create`
  (`docs/triggers.md`; the trigger routes themselves are in the table).
