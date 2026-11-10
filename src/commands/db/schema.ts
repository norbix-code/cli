import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class DbSchema extends BaseCommand {
  static description = `Show one database schema (the latest published version)

The id is the schema id (\`sch_…\`, from \`db schemas\`). A collection name or
title is refused here ("Id is in wrong format. Expected prefix: sch") — look
the id up with \`db schemas --json\` first. Records commands (\`db find\`,
\`db insert\`, …) take the collection name instead.

Returns {item}: viewId (the sch_ id), schemaName, schemaSlug, version (the
published version number), dataSchema.json (the data schema as a JSON string)
and dataSchema.fields (typed fields), visualSchema.json (the UI schema — the
form layout), publishedAt, settings and triggers. The draft is never returned
here: \`db schema draft <id>\` shows it.

Collection references inside dataSchema: a field
{"source":"collection","collectionId":…} accepts the target's sch_ id, its
collection name, or its title when no other collection claims it. The save
stores it as the collection NAME, so a read-back shows
"collectionId":"people" even when you sent the sch_ id. A target the project
does not have is refused with CM-ERRORS-SCHEMA-028. Taxonomy pickers
(taxonomyId) are stored as the taxonomy slug the same way.

Change a schema in five steps — read, edit the draft, preview, publish, read
back:

  # 1. read: the data schema and the UI schema (layout) into files
  norbix db schema sch_7lPCzWonEvTQsheGDCaKq --json | jq -r '.item.dataSchema.json' > orders.schema.json
  norbix db schema sch_7lPCzWonEvTQsheGDCaKq --json | jq -r '.item.visualSchema.json' > orders.ui.json
  # 2. edit the files (run \`norbix db schema rules\` first), save them as the draft
  norbix db schema update sch_7lPCzWonEvTQsheGDCaKq --file orders.schema.json --ui-file orders.ui.json --dry-run
  norbix db schema update sch_7lPCzWonEvTQsheGDCaKq --file orders.schema.json --ui-file orders.ui.json
  # 3. preview: the saved draft (records still use the published version)
  norbix db schema draft sch_7lPCzWonEvTQsheGDCaKq --json
  # 4. publish it
  norbix db schema publish sch_7lPCzWonEvTQsheGDCaKq --dry-run
  norbix db schema publish sch_7lPCzWonEvTQsheGDCaKq --yes
  # 5. read back: version is one higher; compare it with the one before
  norbix db schema sch_7lPCzWonEvTQsheGDCaKq --json | jq '.item.version'
  norbix db schema diff sch_7lPCzWonEvTQsheGDCaKq --from 1 --to 2

Layout (tabs, containers, 12-column cells, widgets) and the data rules:
https://docs.norbix.ai/cloud/database/schema#ui-schema — the schema authoring
guide. Field-by-field shapes: https://docs.norbix.ai/cloud/database/schema/field-types`

  static examples = [
    '<%= config.bin %> db schema sch_7lPCzWonEvTQsheGDCaKq',
    '<%= config.bin %> db schema sch_7lPCzWonEvTQsheGDCaKq --json',
    "<%= config.bin %> db schema sch_7lPCzWonEvTQsheGDCaKq --json | jq -r '.item.dataSchema.json' > orders.schema.json",
  ]

  static args = {
    id: Args.string({required: true, description: 'Schema id (sch_…, from `db schemas`)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchema)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseSchema({id: args.id})

    this.print(res)
    return res
  }
}
