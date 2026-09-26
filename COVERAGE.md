# API endpoint coverage

Compared against the CodeMash docs (`docs/codemash-docs/api-reference`, 452
documented endpoints) on 2026-07-21.

**117 endpoints have a dedicated CLI command. Every SDK method (~180 hub +
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
| notifications/email | 12/47 | templates (list/get/clone/archive/unarchive/delete), campaigns (list/get/stats/stop), module toggle, integrations list |
| notifications/push | 37/37 | every endpoint — see `docs/push.md`; each command is run through the real transport in `tests/push-routes.test.ts` |
| notifications/sms | 12/35 | same set as email |
| scheduler | 7/8 | all except save-task (complex DTO) |
| webhooks | 6/9 | show, secret, rotate, enable/disable/remove destination |
| payments | 7/16 | integrations list, triggers list/get/enable/disable, module toggle |
| account/* | 10/62 | profile, status, usage, projects, team, regions, billing-portal, api keys. Missing: project settings updates, team roles/policies management |
| apikeys | 2/2 | list + regenerate |

Cross-cutting commands: `norbix integrations <module>` lists integrations for
9 modules; `norbix module enable|disable <name>` toggles 10 modules.

## Deliberately skipped (and why)

- **ai/integrations (14)** — skipped on request.
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
- **email/sms create/update template + create campaign** — bodies are big
  design objects (MJML, layouts); better done in the portal today. `norbix api`
  works for scripted cases. (Push has these commands: its template is title +
  body per language, which fits flags.)

## Version note

`email|sms stop` need SDK methods newer than `@norbix.ai/ts@1.2.0`. The
commands detect an older SDK and print the exact `norbix api` fallback line.
`push stop` calls the SDK directly (the CLI requires `@norbix.ai/ts` ^1.3.0).

## How this was measured

Doc file names (kebab-case) were converted to SDK method names (camelCase) and
matched against the methods the CLI actually calls. Regenerate with the same
approach after adding commands.
