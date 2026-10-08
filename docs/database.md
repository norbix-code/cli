# `norbix db`

Work with the Database module from the terminal: records, schemas (collections),
schema triggers, database integrations, taxonomies and their terms, test data.
The routes a developer does not run from a terminal are listed at the end, with
the reason.

Every command is covered by `tests/db-routes.test.ts`, which runs it through the
real SDK with `fetch` replaced and checks the verb and path it sends (so a wrong
route token fails a test), and the request body for the commands that build
one. No test contacts a database.

All paths below are under `/{version}/database`. Record commands (`find`, `get`,
`count`, `distinct`, `insert`, `insert-many`, `update`, `replace`, `delete`,
`aggregate`, `change-owner`, `terms`) call the data-plane API; the rest call the
Hub. Both need only the project API key.

JSON flags take inline JSON, `@file.json`, or `-` for stdin (the older record
commands — `insert`, `update`, `replace`, `delete`, `find` — take inline JSON or
`-`). Flags called `--file` / `--ui-file` take a path, or `-` for stdin.

Many commands take `--integration <id>` to use a database integration other
than the project default.

## Module

`norbix module enable database` / `norbix module disable database` turn the
module on and off (`PUT /enable`, `PUT /disable`). A gateway older than
refactoringV2 (2026-10) has only the GET routes, so this CLI needs a current gateway.

## Records

| command | what it does | endpoint |
|---|---|---|
| `norbix db find <collection> [--filter <json>] [--page-size <n>] [--after <cursor>] [--before <cursor>] [--expand]` | find records | `GET /collections/{collectionName}` |
| `norbix db get <collection> <id> [--expand]` | one record | `GET /collections/{collectionName}/{id}` |
| `norbix db count <collection> [--filter <json>]` | count records | `GET /collections/{collectionName}/count` |
| `norbix db distinct <collection> <field>` | distinct values of one field | `GET /collections/{collectionName}/distinct` |
| `norbix db insert <collection> --doc <json>` | insert one record | `POST /collections/{collectionName}` |
| `norbix db insert-many <collection> --docs <json-array>` | insert many | `POST /collections/{collectionName}/many` |
| `norbix db update <collection> --id <id> --update <json> [--array-filters <json-array>]` | update one | `PUT /collections/{collectionName}/{id}` |
| `norbix db update <collection> --many --filter <json> --update <json> [--array-filters <json-array>] [--yes]` | update many | `PUT /collections/{collectionName}/many` |
| `norbix db update <collection> --all --update <json> [--array-filters <json-array>] [--yes]` | update every record | `PUT /collections/{collectionName}/many` (`allRecords: true`) |
| `norbix db replace <collection> --id <id> --doc <json>` | replace one record fully | `PUT /collections/{collectionName}/{id}/replace` |
| `norbix db delete <collection> --id <id> [--yes]` | delete one | `DELETE /collections/{collectionName}/{id}` |
| `norbix db delete <collection> --many --filter <json> [--yes]` | delete many | `DELETE /collections/{collectionName}/many` |
| `norbix db delete <collection> --all [--yes]` | delete every record | `DELETE /collections/{collectionName}/many` (`allRecords: true`) |
| `norbix db aggregate <collection> --pipeline <json>` | run an inline aggregation | `POST /collections/{collectionName}/aggregate` |
| `norbix db aggregate <collection> --id <aggregateId> [--tokens <json>]` | run a saved aggregate | `POST /collections/{collectionName}/aggregates/{aggregateId}/execute` |
| `norbix db aggregates [--schema <id>]` | list saved aggregates | `GET /aggregates` |
| `norbix db change-owner <collection> <id> --user <userId>` | hand a record to another user | `PUT /collections/{collectionName}/{id}/responsibility` |

The record's owner (responsible user) decides who may read or change it under
"own" permissions. `change-owner` is the only way to move a record to another
user: an update or a replace does not change the owner. The new owner must be a
user of the project in the same environment (`CM-ERRORS-MEMBERSHIP-USERS-012`
otherwise).

Rules for record writes:

- `--update` is the **plain fields** to change, e.g. `'{"status":"paid"}'`. The
  gateway applies them with `$set`. An operator (`$set`, `$inc`, …) is refused
  (`CM-ERRORS-DATABASE-035`); the CLI refuses it before sending.
- An empty filter (`--filter '{}'`) would touch every record, so `update --many`
  and `delete --many` refuse it (`CM-ERRORS-DATABASE-037`). To change or delete
  the whole collection on purpose, use `--all`: it sends `allRecords: true` and
  always asks first (`--yes` skips the question).
- A user with only "own" rights (create as user, update own, delete own) may
  run `insert-many`, `update --many` and `delete --many`; they touch only that
  user's own records.
- A broken `insert`, `insert-many` or `replace` document answers
  `CM-ERRORS-DATABASE-036` ("Invalid record document", with the item index for
  `insert-many`).
- A soft-deleted record is "not found" for `update`, `replace` and
  `change-owner`; `update --many` skips it.

### Reading references: `--expand`

A reference field (user, role, taxonomy term, record of another collection,
file) stores an id. `db find --expand` and `db get --expand` send
`expandReferences: true`: every reference then reads as `{id, display}` —
`display` is the value of the field the schema names as `displayField` on the
target (a role shows its name, a file its name), `null` when the target is
gone; a list of them on a field that holds several ids. Without `--expand` the
stored ids come back unchanged.

The caller needs read rights on the collection **and** on every source the
published schema links to; a missing one refuses the whole read with
`CM-ERRORS-DATABASE-056`, naming the source — a permission gap never looks
like missing data. A file id from an expanded reference opens with
`norbix files get-by-id <id>`.

```bash
norbix db find articles --expand --json | jq '.list.items[] | {title, author: .author.display}'
norbix db get articles 66b2f0a1c3d4e5f6a7b8c9d0 --expand
```

### Nested documents and lists: `--array-filters`

A record is stored as the JSON you send: objects and lists of objects stay
nested at any depth, and the schema is checked at every level (a broken value
names the full path, e.g. `lines[1].qty`). An `--update` key may be a nested
path:

| key | changes |
|---|---|
| `"address.city"` | one field inside an object |
| `"lines.0.qty"` | one list element by position |
| `"lines.$[line].qty"` | the list elements `--array-filters` picks — a JSON array with one filter object per `$[name]` |

`--array-filters` works with `--id`, `--many` and `--all`. The CLI refuses a
value that is not a JSON array of objects before sending; the gateway refuses
a `$[name]` without its filter, or a filter without its `$[name]`.

```bash
norbix db update orders --id 66b2f0a1c3d4e5f6a7b8c9d0 \
  --update '{"lines.$[line].qty":3,"meta.words":130}' \
  --array-filters '[{"line.sku":"A-1"}]'
```

## Collections: indexes and test data

| command | what it does | endpoint |
|---|---|---|
| `norbix db indexes <collection>` | list the indexes of a collection | `GET /collections/{collectionName}/indexes` |
| `norbix db seed --collections <json-array> [--mode dummy\|realistic] [--yes]` | fill several collections with test records | `POST /collections/seed` |

`seed` reads the published schemas, inserts parents before children and puts
real record ids into reference fields, so you never invent an id. It is all or
nothing: every document is validated first. It asks before it writes (`--yes`
skips the question; without a terminal and without `--yes` it exits 3).

```bash
# dummy (default): the server makes up schema-valid records, up to 100 per collection
norbix db seed --collections '[{"collectionName":"families","count":3},{"collectionName":"pairs","count":5}]' --yes

# realistic: you give the documents; a reference to another seeded record is a $seedRef
cat > seed.json <<'JSON'
[
  {"collectionName": "families", "documents": [{"name": "Rosaceae"}]},
  {"collectionName": "pairs", "documents": [{"family": {"$seedRef": {"collection": "families", "index": 0}}}]}
]
JSON
norbix db seed --mode realistic --collections @seed.json --yes
```

The answer is a report per collection: insert order, requested and inserted
counts, the new ids, and any errors.

## Schemas

| command | what it does | endpoint |
|---|---|---|
| `norbix db schemas [--page-size <n>] [--after <cursor>]` | list the schemas of one environment (`--env`, default PROD); each row carries `env` | `GET /schemas` |
| `norbix db schema <id>` | show one schema | `GET /schemas/{id}` |
| `norbix db schema create --name <name> --file <data-schema.json> [--ui-file <ui.json>] [--settings <json>]` | create a schema | `POST /schemas` |
| `norbix db schema update <id> [--file <data-schema.json>] [--ui-file <ui.json>]` | save a change as the draft | `PUT /schemas/{Id}/draft` |
| `norbix db schema draft <id>` | show the unpublished draft | `GET /schemas/{Id}/draft` |
| `norbix db schema discard <id> [--yes]` | throw the draft away | `DELETE /schemas/{Id}/draft` |
| `norbix db schema publish <id> [--yes]` | publish the draft | `POST /schemas/{Id}/publish` |
| `norbix db schema versions <id>` | list the published versions | `GET /schemas/{Id}/versions` |
| `norbix db schema diff <id> --from <n> --to <n>` | what changed between two versions | `GET /schemas/{Id}/versions/diff` |
| `norbix db schema index-status <id>` | the last schema-index run: the indexes Norbix made (`idx_<field>` per reference, `uniq_<field>` per unique field, `idx_<field>__id` for the default sort, at most 8), state `building` / `ready` / `refused` / `partial` per database | `GET /schemas/{Id}/index-status` |
| `norbix db schema delete <id> [--yes]` | delete the schema **and its records**: the collection (records and indexes) in the environment is dropped, and removed from the AI knowledge when AI embed is on; no undo. Refused while a schema trigger uses it (`CM-ERRORS-SCHEMA-017`) or a saved aggregate starts on / joins it (`CM-ERRORS-SCHEMA-018`, the aggregates are in `BlockerAggregateNames`); then nothing is dropped | `DELETE /schemas/{Id}` |

`--file` is the data schema (the JSON Schema of one record); `--ui-file` is the
UI schema the dashboard form uses. A change is a draft first: records keep the
published version until `schema publish`. `publish` asks first and sends the
server's `confirmed: true`, so it also publishes a change the server calls
breaking — read `schema draft` (or `schema diff` after a publish) before you
answer yes.

```bash
norbix db schema create --name orders --file orders.schema.json --ui-file orders.ui.json
norbix db schema update 66b2f0a1c3d4e5f6a7b8c9d0 --file orders.schema.json
norbix db schema draft 66b2f0a1c3d4e5f6a7b8c9d0
norbix db schema publish 66b2f0a1c3d4e5f6a7b8c9d0 --yes
norbix db schema diff 66b2f0a1c3d4e5f6a7b8c9d0 --from 1 --to 2
```

## Schema triggers

A schema trigger runs an action (send an e-mail, a push, an SMS, call a
webhook …) when records of a schema are inserted, updated or deleted.

| command | what it does | endpoint |
|---|---|---|
| `norbix db triggers [--schema <id>] [--page-size <n>] [--after <cursor>]` | list triggers | `GET /schemas/triggers` |
| `norbix db trigger <id> [--schema <id>]` | show one trigger | `GET /schemas/triggers/{id}` |
| `norbix db trigger create --file <trigger.json> [--schema <id>] [--id <triggerId>] [--order <n>] [--[no-]break-on-error]` | create (or, with `--id`, update) a trigger | `POST /schemas/triggers` |
| `norbix db trigger enable <id>` | turn it on | `PATCH /schemas/triggers/{triggerId}/enable` |
| `norbix db trigger disable <id> [--yes]` | turn it off | `PATCH /schemas/triggers/{triggerId}/disable` |
| `norbix db trigger delete <id> [--yes]` | delete it | `DELETE /schemas/triggers/{triggerId}` |

Schema triggers belong to one environment. Every trigger command works on the
copy in the request environment (`--env`, PROD when none is set): `db triggers`
lists only that environment's triggers (each row has `env`), and enable /
disable / delete of an id with no copy there answers `CM-ERRORS-TRIGGERS-002`
(not found). `db trigger <id>` shows `schemaId` (the owning schema, `sch_…`)
and `env`. `trigger create --id` with an id that belongs to another schema is
also `CM-ERRORS-TRIGGERS-002`.

The file holds the trigger — the same shape `db trigger <id> --json` shows:
name, `schemaId`, the record events it reacts to, and `action` (`{type, …}`).
`"type": "Schema"` is added when the file leaves it out. A file that holds the
whole request (`{"trigger": {…}}`) works too. `--schema` and `--id` win over the
file. The action names an integration and a template of the e-mail, push or SMS
module: look them up with `norbix email integrations` / `norbix email templates`
(and the push / sms equivalents).

When several triggers fire for the same record event they run as a queue.
`--order <n>` sets this trigger's place (0 or more, lower runs first; a trigger
without an order runs after the numbered ones, equal places run by name) and
`--break-on-error` stops the later triggers of the event when this one's action
fails (`--no-break-on-error` turns it off). Both win over `order` /
`breakOnError` in the file; `db trigger <id>` shows them back. An update
replaces the whole trigger, so keep the rest of the file as it was.

```bash
norbix db trigger create --file notify-on-order.json --schema 66b2f0a1c3d4e5f6a7b8c9d0
norbix db trigger create --file notify-on-order.json --id 66b2f0a1c3d4e5f6a7b8c9d1 --order 1 --break-on-error
norbix db trigger disable 66b2f0a1c3d4e5f6a7b8c9d1 --yes
```

## Integrations

| command | what it does | endpoint |
|---|---|---|
| `norbix db integrations [--page-size <n>] [--after <cursor>]` | list the database integrations | `GET /integrations` |
| `norbix db integration <id>` | show one | `GET /integrations/{id}` |
| `norbix db integration test <id>` | check that the database behind it answers (writes nothing) | `POST /integrations/test` |
| `norbix db integration default <id>` | make it the project default | `PUT /integrations/{Id}/default` |

`norbix integrations database` lists them too, for scripts that treat every
module alike.

## Taxonomies and terms

| command | what it does | endpoint |
|---|---|---|
| `norbix db taxonomies` | list taxonomies | `GET /taxonomies` |
| `norbix db taxonomy <id>` | show one taxonomy | `GET /taxonomies/{id}` |
| `norbix db terms <taxonomyName> [--filter <json>] [--page-size <n>] [--after <cursor>] [--desc]` | list the terms of a taxonomy | `GET /taxonomies/{taxonomyName}/terms` |
| `norbix db terms <taxonomyName> --parent <termId>` | only the children of one term | `GET /taxonomies/{taxonomyName}/terms/{parentId}/children` |
| `norbix db term <taxonomyId> <id>` | show one term | `GET /taxonomies/{TaxonomyId}/terms/{Id}` |
| `norbix db term tree <taxonomyName> [--root <termId>] [--depth <n>]` | the terms as a tree | `GET /taxonomies/{TaxonomyName}/terms/tree` |
| `norbix db term tree <taxonomyName> --merged` | one tree across the parent taxonomies | `GET /taxonomies/{TaxonomyName}/merged-tree` |
| `norbix db term create <taxonomyId> --doc <json>` | add a term | `POST /taxonomies/{TaxonomyId}/terms` |
| `norbix db term update <taxonomyId> <id> --set <json>` | change some fields of a term | `PUT /taxonomies/{TaxonomyId}/terms/{Id}` |
| `norbix db term delete <taxonomyId> <id> [--yes]` | delete a term | `DELETE /taxonomies/{TaxonomyId}/terms/{Id}` |

Note the two kinds of key: listing and trees take the taxonomy **name**; a single
term is addressed by the taxonomy **id** and the term id (that is how the
gateway routes them). `--set` is applied with `$set`: only the fields you give
change — `name` (a string or a `{lang: value}` map), `description`, `order`
(lower shows first), `parentId`, `multiParents`.

`db taxonomies` lists each taxonomy's parents as `dependencyRefs`
(`[{id, name}]`, in the order of `dependencies`; a parent that no longer exists
keeps its place with `name: null`).

Reading terms by taxonomy name (`terms`, `term tree`, `term tree --merged`)
needs read rights on that taxonomy's terms (`database:term:<taxonomy id>`); the
merged tree checks every parent taxonomy too. Errors you may meet:
`CM-ERRORS-TAXONOMIES-010` (no taxonomy with that name),
`CM-ERRORS-TAXONOMIES-011` (the tree has more than 5000 terms — read a
`--root` branch or page with `terms` instead) and `CM-ERRORS-TAXONOMIES-005`
(a name longer than 40 characters).

```bash
norbix db term create 66b2f0a1c3d4e5f6a7b8c9d0 --doc '{"name":"Lithuania","order":1}'
norbix db term update 66b2f0a1c3d4e5f6a7b8c9d0 66b2f0a1c3d4e5f6a7b8c9d1 --set '{"order":2}'
norbix db term tree countries --depth 2
```

## Agents and scripts

- `--json` prints the server's answer (or the dry-run report) as JSON on stdout.
- `--dry-run` on every write prints the SDK call and the HTTP request, and
  sends nothing — the server does not check the values. `db schema create
  --dry-run` does not validate the JSON Schema file. A schema bundle can be
  checked: `norbix hub database schema bundle apply --bundleJson '<IF json>'
  --dry-run` asks the Hub's read-only `account.validateSchema` and exits 6
  with the issues when the bundle is invalid.
- `delete`, `discard`, `publish`, `seed`, `trigger disable`, `trigger delete`,
  `term delete` and the `--many` / `--all` record writes ask first; `--yes` skips the
  question, and without a terminal they exit 3 unless `--yes` is given.
- Exit codes are in the README ("Errors and exit codes").

## No command on purpose

These Database routes exist in the gateway and the SDKs, but are not commands
yet: they are dashboard settings, or their body is the dashboard's own editor
state. `norbix hub database <words…>` reaches every one of them.

| endpoint | why there is no command |
|---|---|
| `POST /taxonomies`, `DELETE /taxonomies/{Id}`, `GET /taxonomies/tree`, `DELETE /taxonomies/{TaxonomyId}/terms/many` | Taxonomy structure (dependencies, translatable names) is edited in the dashboard; terms — the data — have commands. |
| `POST /schemas/apply-bundle` | Applies a whole generated bundle of schemas; it is the AI schema builder's step, not a hand-run one. |
| `PUT /schemas/{Id}/rename`, `/embed`, `/list-settings`, `/settings` | Dashboard settings of one schema (title, embedding, list columns, soft delete / owner). |
| `POST /integrations`, `DELETE /integrations/{Id}`, `PUT /integrations/{Id}/enable` / `disable`, `GET /integrations/flex-tiers`, `GET /integrations/{Id}/connection-string` | Creating or removing a database, and revealing its connection string, are account-level decisions taken in the dashboard; a connection string should not land in a shell history. |
| `POST /aggregates`, `DELETE /aggregates/{Id}`, `GET /aggregates/{Id}`, `POST /aggregates/test` | Saved aggregates are written in the dashboard's pipeline editor; `db aggregate --id` runs one and `db aggregate --pipeline` runs any pipeline. |
| `/imports/**` | The CSV / JSON import flow (upload URL, analyze, create) is a dashboard wizard; out of the audit scope. |
| Hub `/collections/**` record routes | The same record operations as the data-plane API routes the record commands already use. |
