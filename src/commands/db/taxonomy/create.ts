import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {fileSource, readJsonText} from '../../../lib/database.js'

export default class DbTaxonomyCreate extends BaseCommand {
  static description = `Create a database taxonomy (a list of terms, e.g. countries or allergens)

<name> is the title ("Allergens"); the Hub derives the slug ("allergens")
that \`db terms <name>\` and schema references use. Add terms afterwards with
\`db term create <taxonomy id or name> --doc <json>\`.

--terms-meta-schema is an optional data meta-schema (JSON) of the custom fields
every term of this taxonomy has; --terms-ui-schema the form that edits them.
--parent makes it a child taxonomy (its terms can have a parent term there).`

  static examples = [
    '<%= config.bin %> db taxonomy create Allergens',
    '<%= config.bin %> db taxonomy create Allergens --description "Food allergens" --dry-run',
    '<%= config.bin %> db taxonomy create Symptoms --terms-meta-schema symptom.meta.json',
    '<%= config.bin %> db taxonomy create Cities --parent txn_5BBS25C3IKHRfzVABMjMiM',
  ]

  static args = {
    name: Args.string({required: true, description: 'Taxonomy title, e.g. "Allergens"'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    description: Flags.string({description: 'Free-text description'}),
    'terms-meta-schema': Flags.string({description: 'JSON file with the meta-schema of the terms\' custom fields (or `-` for stdin)'}),
    'terms-ui-schema': Flags.string({description: 'JSON file with the UI schema of the terms\' edit form'}),
    parent: Flags.string({description: 'Parent taxonomy id (txn_…): makes this a child taxonomy'}),
    dependency: Flags.string({description: 'Another taxonomy id this one depends on for multi-parent terms (repeatable)', multiple: true}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTaxonomyCreate)
    const client = this.client(flags)

    // No viewId: the Hub creates a new taxonomy (with one it would replace that taxonomy).
    const res = await client.hub.database.saveDatabaseTaxonomy({
      taxonomyName: args.name,
      description: flags.description,
      termsMetaDataSchema: flags['terms-meta-schema'] ? await readJsonText(fileSource(flags['terms-meta-schema']), 'terms-meta-schema') : undefined,
      termsMetaVisualSchema: flags['terms-ui-schema'] ? await readJsonText(fileSource(flags['terms-ui-schema']), 'terms-ui-schema') : undefined,
      parentId: flags.parent,
      dependencies: flags.dependency,
    })

    this.print(res && typeof res === 'object' && 'id' in res ? `Taxonomy "${args.name}" created: ${String((res as {id?: unknown}).id)}.` : res)
    return res
  }
}
