# Integrations from the terminal

Every module keeps its provider connections as **integrations**. The Email,
Push, SMS, Payments, Database and AI modules have had their commands for a
while ([docs/email.md](email.md), [docs/push.md](push.md), [docs/sms.md](sms.md),
[docs/payments.md](payments.md), [docs/database.md](database.md),
[docs/ai.md](ai.md)). This page covers the rest — Files, Code, Logs and
Membership — and the two cross-module pieces: keyless cloud setup and quick
connect.

Every module reads the same way: `norbix <module> integrations` lists,
`norbix <module> integration <id>` shows one, `norbix <module> integration
<verb> …` acts on one. Every command is covered by
`tests/<module>-integration-routes.test.ts`, which runs it through the real
`@norbix.ai/ts` transport with `fetch` replaced and checks the verb, the path
and the body it sends. No test contacts a provider.

## Save: the shape of every `integration save`

```
norbix <module> integration save --provider <p> [--name <n>] [--id <id>] [--disabled] [--config <json>]
```

`--provider` picks the body shape; `--config` carries the provider-specific
fields as a JSON object (inline, `@file.json`, or `-` for stdin); the flags win
over the same keys in it. The output of `norbix <module> integration <id>` can
be fed back as `--config` (bare or wrapped in `{"integration": …}`): its
`viewId` becomes the id to update, the server-set fields are dropped, so no
second integration is created. `--dry-run` prints the request and sends
nothing.

**Keyless cloud providers** (AWS, Azure, Google — Files, Code, Logs): leave
`authMode` out of `--config`, or set it to `Keyless`; no secret is stored. Run
`norbix integrations keyless-setup <module> <cloud>` first, set up the trust it
prints in the cloud account, and save with the integration id it printed
(`--id`). A key mode (`"authMode": "AccessKey"`) is refused unless `--config`
also carries `"acceptKeyRisk": true` (`CM-ERRORS-INTEGRATIONS-034`).

## Files integrations

All paths are under `/{version}/files/integrations`. Providers: `Local`,
`AwsS3`, `AzureBlobStorage`, `GoogleCloudStorage`, `Ftp`, `AppleICloud`,
`DropBox`, `GoogleDrive`.

| command | what it does | endpoint |
|---|---|---|
| `norbix files integrations [--page-size <n>] [--after <cursor>]` | list the integrations | `GET /` |
| `norbix files integration <id>` | show one | `GET /{id}` |
| `norbix files integration save --provider <p> …` | create or update one | `POST /` |
| `norbix files integration test <id>` (also `files integrations test <id>`) | live probe: upload, read, list, delete | `POST /test` |
| `norbix files integration enable <id>` | turn it on | `PUT /{Id}/enable` |
| `norbix files integration disable <id> [--yes]` | turn it off | `PUT /{Id}/disable` |
| `norbix files integration default <id>` | make it the project default | `PUT /{Id}/default` |
| `norbix files integration delete <id> [--yes]` | delete it | `DELETE /{Id}` |

```sh
norbix integrations keyless-setup files aws --template terraform > norbix-files.tf
norbix files integration save --provider AwsS3 --name Invoices --id <id from keyless-setup> \
  --config '{"bucketName":"my-invoices","region":"eu-central-1","roleArn":"arn:aws:iam::123456789012:role/norbix-files"}'
norbix files integration test <id>
```

## Code integrations

All paths are under `/{version}/code/integrations`. Providers: `Sandbox` (API
value `Fake`: runs no real function, contacts no cloud), `AwsLambda`,
`AzureFunctions`, `GoogleCloudFunctions`, `Pipedream`, `Zapier`,
`CloudflareWorkers`, `Vercel`, `Netlify`, `SupabaseEdge`, `Modal`.

| command | what it does | endpoint |
|---|---|---|
| `norbix code integrations [--page-size <n>] [--after <cursor>]` | list the integrations | `GET /` |
| `norbix code integration <id>` | show one | `GET /{id}` |
| `norbix code integration save --provider <p> …` | create or update one | `POST /` |
| `norbix code integration test --integration <id>` | live call to the provider | `POST /test` |
| `norbix code integration confirm-delivery <id>` | confirm you saw the test call arrive | `POST /confirm-human-delivery` |
| `norbix code integration enable <id>` | turn it on | `PUT /{Id}/enable` |
| `norbix code integration disable <id> [--yes]` | turn it off | `PUT /{Id}/disable` |
| `norbix code integration delete <id> [--yes]` | delete it | `DELETE /{Id}` |

The functions an integration may call, and a call by hand:
[docs/code.md](code.md).

## Logging integrations

All paths are under `/{version}/logs/integrations`. Nothing is delivered to an
integration until its last test passed — run `test` after every save.
Providers: `Console`, `NorbixLogging`, `DataDog`, `NewRelic`, `Sentry`,
`GrafanaLoki`, `Axiom`, `ElasticCloud`, `AWSCloudWatch`, `GCPCloudLogging`,
`AzureMonitorLogs`, `GenericHttp`, `Kafka`, `AMQP`, `Prometheus`, `AzureOTel`,
`Splunk`, `ElasticSearch`, `Kibana`, `LocalFile`, `AWSS3`, `AWSKinesis`,
`MongoDB`, `InternalKafka`.

| command | what it does | endpoint |
|---|---|---|
| `norbix logs integrations [--page-size <n>] [--after <cursor>]` | list the integrations | `GET /` |
| `norbix logs integration <id>` | show one | `GET /{id}` |
| `norbix logs integration save --provider <p> …` | create or update one | `POST /` |
| `norbix logs integration test --integration <id>` | live write to the provider | `POST /test` |
| `norbix logs integration enable <id>` | turn it on | `PUT /{Id}/enable` |
| `norbix logs integration disable <id> [--yes]` | turn it off | `PUT /{Id}/disable` |
| `norbix logs integration delete <id> [--yes]` | delete it | `DELETE /{Id}` |

Reading and writing the entries themselves: `norbix logs list/trail/get/write`
in the [README](../README.md).

## Membership (sign-in) integrations

All paths are under `/{version}/membership/integrations`. Providers:
`AppleSignIn`, `GoogleSignIn`, `Google`, `Facebook`, `X`, `GitHub`, `LinkedIn`,
`Okta`, `Microsoft` — the client id, the client secret and the other provider
fields go in `--config`. No `test` route: the gateway has none for sign-in
providers. No default either: the app names the provider when a user signs in.

| command | what it does | endpoint |
|---|---|---|
| `norbix membership integrations [--page-size <n>] [--after <cursor>]` | list the integrations | `GET /` |
| `norbix membership integration <id>` | show one | `GET /{id}` |
| `norbix membership integration save --provider <p> …` | create or update one | `POST /` |
| `norbix membership integration enable <id>` | turn it on | `PUT /{Id}/enable` |
| `norbix membership integration disable <id> [--yes]` | turn it off | `PUT /{Id}/disable` |
| `norbix membership integration delete <id> [--yes]` | delete it | `DELETE /{Id}` |

## Keyless cloud setup (every module)

`norbix integrations keyless-setup <module> <cloud>` — `GET
/{version}/integrations/keyless/setup`. Modules: `files`, `email`, `code`
(on `aws`, `azure`, `google`), `logs` (`aws`, `azure`), `push` and `payments`
(`google`), `database` (`atlas`, MongoDB Atlas M10+). It prints the issuer, the
subject and the audience the cloud must trust, whether keyless works on this
gateway (with the reason when not), the setup script and the ready template
files; `--template cloudformation|bicep|terraform` prints one file for piping.
Covered by `tests/integrations-keyless-setup.test.ts`.

## Quick connect (one-click OAuth) — payments

Quick connect saves a payments integration without pasting keys: the provider's
page asks the person to approve, sends them back to Norbix, and the integration
is saved from the account they pick. Five routes a person calls
(`Hub.Payments/Integrations/Connect/QuickConnect.cs`); covered by
`tests/integrations-connect.test.ts`.

| command | what it does | endpoint |
|---|---|---|
| `norbix integrations connect providers [--module <m>]` | which providers can quick-connect here, their inputs and modes | `GET /integrations/connect/providers` |
| `norbix payments integration connect start --provider <p> --name <n> [--mode <m>] [--input k=v]... [--integration <id>]` | start: prints the page to open and the connect id | `POST /payments/integrations/connect/start` |
| `norbix integrations connect targets <connectId>` | the accounts the provider offered, once the person approved | `GET /integrations/connect/{ConnectId}/targets` |
| `norbix payments integration connect complete <connectId> --target <id> [--disabled]` | finish: save the integration from the picked account | `POST /payments/integrations/connect/{ConnectId}/complete` |
| `norbix payments integration connect disconnect <id> [--yes]` | end the connection: webhooks removed, key forgotten, integration off | `POST /payments/integrations/{Id}/connect/disconnect` |

```sh
norbix integrations connect providers --module payments
norbix payments integration connect start --provider woocommerce --name Shop --input storeUrl=https://shop.example.com
# open the printed page, approve, come back
norbix integrations connect targets qc_…
norbix payments integration connect complete qc_… --target shop_42
```

Not commands: `GET|POST /integrations/connect/callback/{Provider}` (the
provider sends the person back there) and `GET
/integrations/connect/devfake/authorize` (the fake provider's page in
development).
