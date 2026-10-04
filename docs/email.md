# `norbix email`

Manage e-mail from the terminal. Every Email endpoint a developer calls has a
command; the three that do not are listed at the end, with the reason.

Every command is covered by `tests/email-routes.test.ts`, which runs it through
the real SDK with `fetch` replaced and checks the verb and path it sends (so a
wrong route token fails a test). `tests/email.test.ts` and
`tests/email-existing.test.ts` also check the request fields. No test contacts
a mail service; the only provider a test saves is **Fake**.

All paths below are under `/{version}/notifications/email`, except
`campaign messages` (the gateway spells that route `/notifications/emails/…`).

## Module

| command | what it does | endpoint |
|---|---|---|
| `norbix email enable` | turn the email module on | `GET /enable` |
| `norbix email disable [--yes]` | turn the email module off | `GET /disable` |
| `norbix email disable-dependencies` | list what still depends on email — check before `disable` | `GET /disable-dependencies` |
| `norbix email settings [--id <id>]` | show the project email settings | `GET /settings` |

`norbix module enable email` / `norbix module disable email` do the same as the
first two, for scripts that treat every module alike.

## Integrations

| command | what it does | endpoint |
|---|---|---|
| `norbix email integrations [--page-size <n>] [--after <cursor>]` | list the integrations | `GET /integrations` |
| `norbix email integration <id>` | show one integration | `GET /integrations/{id}` |
| `norbix email integration save --provider <p> [--name <n>] [--id <id>] [--from <address>] [--sender-name <n>] [--disabled] [--config <json>]` | create or update an integration | `POST /integrations` |
| `norbix email integration enable <id>` | turn it on | `PUT /integrations/{Id}/enable` |
| `norbix email integration disable <id>` | turn it off | `PUT /integrations/{Id}/disable` |
| `norbix email integration default <id>` | make it the project default | `PUT /integrations/{Id}/default` |
| `norbix email integration delete <id> [--yes]` | delete it | `DELETE /integrations/{Id}` |
| `norbix email integration test --integration <id> --to <address>` | send a test e-mail | `POST /integrations/test` |
| `norbix email integration confirm-delivery <id>` | confirm the test e-mail reached a person | `POST /integrations/confirm-human-delivery` |
| `norbix email integration domain-health <id>` | check SPF / DKIM / DMARC of the sending domain (read only) | `POST /integrations/domain-health` |

`--provider` is one of `Fake`, `Smtp`, `SendGrid`, `MailGun`, `AwsSes`. **Fake**
needs nothing else: it accepts every send and contacts no mail service, so
nothing reaches a real inbox — use it while you develop. A project can hold one
Fake and it has no update path: delete it and add it again. The real providers
need a sender (`--from`) and their credentials: put the provider-specific
fields in `--config` as a JSON object (inline, `@file.json`, or `-` for stdin)
so a key does not land in your shell history.

```bash
norbix email integration save --provider Fake
norbix email integration save --provider SendGrid --name SendGrid --from hello@example.com --config @sendgrid.json
norbix email integration test --integration int_123 --to dev@example.com
norbix email integration confirm-delivery int_123
norbix email integration domain-health int_123
```

## Validation integrations

| command | what it does | endpoint |
|---|---|---|
| `norbix email validation save --provider <p> --name <n> [--id <id>] [--disabled] [--config <json>]` | create or update an email-validation integration | `POST /validation/integrations` |
| `norbix email validation test <id>` | check it can reach its provider (no e-mail is sent) | `POST /validation/integrations/test` |

`--provider` is one of `ZeroBounce`, `NeverBounce`, `Bouncer`,
`MailgunValidate`; the API key goes in `--config` (`{"apiKey": "…"}`). A
campaign uses it with `email campaign create --validation-integration <id>`.
The gateway has no list / get / delete route for these yet; they show up in
the portal.

## Footers and signatures

| command | what it does | endpoint |
|---|---|---|
| `norbix email footers [--page-size <n>] [--after <cursor>]` | list footers | `GET /footers` |
| `norbix email footer <id>` | show one footer | `GET /footers/{id}` |
| `norbix email footer save --name <n> (--content <html> \| --content-file <f> \| --translations <json>) [--id <id>] [--language <l>]` | create or update a footer | `POST /footers` |
| `norbix email footer delete <id> [--yes]` | delete a footer | `DELETE /footers/{id}` |
| `norbix email signatures [--page-size <n>] [--after <cursor>]` | list signatures | `GET /signatures` |
| `norbix email signature <id>` | show one signature | `GET /signatures/{id}` |
| `norbix email signature save --name <n> (--content <html> \| --content-file <f> \| --translations <json>) [--id <id>] [--language <l>]` | create or update a signature | `POST /signatures` |
| `norbix email signature delete <id> [--yes]` | delete a signature | `DELETE /signatures/{id}` |

The content is HTML with Razor tokens, one per language. For several languages
pass `--translations` with a JSON array of `{"language": "en", "content": "…"}`.
`save` sends the whole footer / signature, so include every language you want
to keep.

## Templates

| command | what it does | endpoint |
|---|---|---|
| `norbix email templates [--archived]` | list templates | `GET /templates` |
| `norbix email template <id>` | show one template | `GET /templates/{id}` |
| `norbix email template create --name <n> (--subject <s> (--body <code> \| --body-file <f>) \| --translations <json>)` | create a template | `POST /templates` |
| `norbix email template update <id> --name <n> (…same as create…)` | replace a template | `PUT /templates` |
| `norbix email template tokens <id>` | list the tokens the template uses | `GET /templates/{id}/tokens` |
| `norbix email template render (--code <mjml> \| --file <f>) [--token key=value]... [--preview]` | render MJML + Razor to HTML | `POST /templates/mjml` |
| `norbix email template attach <id> --file-ref <json> [--language <l>]` | attach an uploaded file to every e-mail of the template | `POST /templates/attachments` |
| `norbix email system-templates [--tag <t>]... [--theme <t>]... [--channel <c>] [--trigger <t>]` | list ready-made templates | `GET /system-templates` |
| `norbix email system-template <id>` | show one ready-made template | `GET /system-templates/{id}` |
| `norbix email archive <id>` | archive a template | `PUT /templates/{Id}/archive` |
| `norbix email unarchive <id>` | restore an archived template | `PUT /templates/{Id}/unarchive` |
| `norbix email clone <id>` | copy a template | `POST /templates/{Id}/clone` |
| `norbix email delete <id> [--yes]` | delete a template | `DELETE /templates/{Id}` |

`create` and `update` also take `--description`, `--channel`
(`Transactional` · `Marketing` · `System`, default `Transactional`), `--tag`
(repeat for several), `--language` (default `en`) and `--engine` (default
`Mjml`; also `Razor`, `Handlebars`, `Liquid`, `Mustache`). The body is MJML with
Razor tokens — `@Model.Name`, not `{{Name}}`. Because Razor code itself starts
with `@`, a file is read with `--body-file`, not `--body @file`. For several
languages pass `--translations` with a JSON array of
`{"language": "en", "content": {"subject": "…", "body": {"code": "…", "templateEngine": "Mjml"}}}`.
`update` sends the whole template, so include every language you want to keep.

`attach` takes the file reference a `norbix files upload` returned
(`{resource, integrationId, provider, path, isPublic}`), as inline JSON,
`@file.json` or `-`.

```bash
norbix email template render --file welcome.mjml --token Name=Ada
norbix email template create --name Welcome --subject "Hi @Model.Name" --body-file welcome.mjml
norbix email template tokens tpl_123
```

## Campaigns

| command | what it does | endpoint |
|---|---|---|
| `norbix email campaigns [--page-size <n>] [--after <cursor>]` | list campaigns | `GET /campaigns` |
| `norbix email campaign <id>` | show a campaign | `GET /campaigns/{id}` |
| `norbix email campaign <id> --stats` | show its delivery statistics instead | `GET /campaigns/{id}/stats` |
| `norbix email campaign create --template <id> --integration <id> --audience <a> …` | create (and send or schedule) a campaign | `POST /campaigns` |
| `norbix email campaign delete <id> [--yes]` | delete a campaign | `DELETE /campaigns/{Id}` |
| `norbix email stop <id> [--yes]` | stop a running campaign | `POST /campaigns/{Id}/stop` |
| `norbix email campaign batches <id> [--batch <b>] [--email <address>]` | list its send batches | `GET /campaigns/{id}/batches` |
| `norbix email campaign batch <id> <batchId>` | list the e-mails in a batch | `GET /campaigns/{id}/batches/{batchId}` |
| `norbix email campaign batch <id> <batchId> <notificationId>` | show one e-mail in a batch | `GET /campaigns/{id}/batches/{batchId}/{notificationId}` |
| `norbix email campaign messages <id> --batch <batchId>` | list the e-mails it sent in a batch | `GET /notifications/emails/campaigns/{campaignId}/messages` |
| `norbix email preview <hash>` (or `--hash <hash>`) | show the subject and HTML behind a preview link | `GET /preview` |
| `norbix email preview --notification <id>` | show the subject and HTML of one sent e-mail of your project | `GET /preview` |

`--audience` decides who receives the campaign:

| `--audience` | recipients | flags |
|---|---|---|
| `all-users` | every user with an e-mail address | narrow with `--role`, `--tag` |
| `users` | the named users | `--user` (repeat), `--cc` / `--bcc` user IDs, `--one-each` |
| `account-users` | the named account users | `--user` (repeat), `--cc` / `--bcc`, `--one-each` |
| `emails` | raw e-mail addresses | `--email` (repeat), `--cc` / `--bcc` addresses, `--one-each` |
| `collection` | records of a collection whose field holds the recipient | `--schema`, `--field` (repeat), `--field-type User\|Email` (default `User`), `--role` |

`--one-each` sends every recipient a separate e-mail; without it the recipients
share one e-mail.

**`--integration` is required** — it names the e-mail provider the campaign sends
through (list them with `norbix email integrations`). The server never falls back
to the project default and refuses a campaign without one
(`CM-ERRORS-INTEGRATIONS-003`). Languages come from Project settings: the
template must have a translation for every project language
(`CM-ERRORS-LANGUAGES-004`), and `--language` (send everything in one language)
must be one of the project's languages (`CM-ERRORS-LANGUAGES-003`). Without
`--language` each recipient gets their own language, else the project default.
`--initiator <userId>` sends on behalf of another project user — their details
fill the `Initiator.User.*` tokens (default: you).

Other `create` flags: `--validation-integration` (check every address first),
`--language`, `--initiator`, `--notes`, `--at` (send later — ISO 8601 date-time or Unix
seconds; without it the campaign is sent right away), `--token key=value`
(repeat), `--database-integration`, and `--config` for any other campaign field
as a JSON object.

```bash
norbix email campaign create --template tpl_123 --integration int_123 --audience all-users --tag beta
norbix email campaign create --template tpl_123 --integration int_123 --audience emails --email ada@example.com --at 2026-10-01T09:00:00Z
norbix email campaign batches cmp_123
norbix email campaign batch cmp_123 bat_456 ntf_789
norbix email preview --notification ntf_789
```

`email preview <hash>` takes the opaque hash the backend puts in a preview
link — you cannot build it yourself, so copy it out of the link. The signed
link is the key: it needs **no login and no project** (the default endpoints
still need `--region`). `email preview --notification <id>` is the signed-in
way for your own project and needs a login with `email:read`. A `401` means the
link is invalid or expired, or you may not read that e-mail.

## No command on purpose

These Email routes exist in the gateway, but nobody runs them from a terminal:

| endpoint | why there is no command |
|---|---|
| `GET /{version}/email/preferences?token=…` | The recipient's own preferences page. The token comes from the Preferences / Unsubscribe link inside one received e-mail and the page is opened by that person in a browser, not by a developer of the project. The SDKs have `getEmailPreferencesByLink` for a custom page. |
| `POST /{version}/email/one-click-unsubscribe` | The RFC 8058 one-click unsubscribe: the recipient's mail client (Gmail, Outlook) posts the encrypted token from the `List-Unsubscribe` header. A command would only unsubscribe a real recipient by hand. |
| `POST /{version}/email/webhooks/mailgun/{projectId}/{integrationId}` | Mailgun calls it with delivery events, signed with the integration's webhook signing key. A person never calls it; the SDKs have no method for it. |

## Not offered on purpose

- **`--send-now` on `campaign create`**: `@norbix.ai/ts` 4.4.0 has a `sendNow`
  field, but it comes from a gateway branch that is not released yet (the AI
  campaign-timing rule); the released gateway ignores it. Without `--at` a
  campaign is already sent right away.
