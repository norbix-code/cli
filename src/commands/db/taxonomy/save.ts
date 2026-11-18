import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {usageError} from '../../../lib/cli-error.js'
import {readJsonText} from '../../../lib/database.js'
import {READ_FIRST_DRY_RUN, listOf, nothingRead} from '../../../lib/membership.js'

export default class DbTaxonomySave extends BaseCommand {
  static description = `Create or update a database taxonomy

Without --id it creates one: --name is required (the slug is derived from
it). With --id it updates that taxonomy: the gateway replaces the whole
taxonomy (name, description, parent, dependencies and the term field
schemas), so the command reads it first and changes only what you pass.

--parent makes this taxonomy a child of another one (each term can then have
a parent term there); --depends-on lists the taxonomies its terms may take
several parents from. --term-fields / --term-form set the extra fields every
term of the taxonomy has (a data schema and its form layout, JSON: inline,
@file or -). --clear-description, --clear-parent, --clear-depends-on and
--clear-term-fields (both term schemas) remove what they name.

${READ_FIRST_DRY_RUN}`

  static examples = [
    '<%= config.bin %> db taxonomy save --name Countries --description "Where we ship"',
    '<%= config.bin %> db taxonomy save --name Cities --parent txn_1',
    '<%= config.bin %> db taxonomy save --id txn_2 --term-fields @city-fields.json --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    id: Flags.string({description: 'Taxonomy ID — set it to update instead of create'}),
    name: Flags.string({description: 'Title, e.g. Countries (max 40 characters)'}),
    description: Flags.string({description: 'Description', exclusive: ['clear-description']}),
    'clear-description': Flags.boolean({description: 'Remove the description', default: false}),
    parent: Flags.string({description: 'Parent taxonomy ID', exclusive: ['clear-parent']}),
    'clear-parent': Flags.boolean({description: 'Make it a root taxonomy', default: false}),
    'depends-on': Flags.string({description: 'Taxonomy IDs for multi-parent terms, comma separated (repeatable)', multiple: true, exclusive: ['clear-depends-on']}),
    'clear-depends-on': Flags.boolean({description: 'Remove every dependency', default: false}),
    'term-fields': Flags.string({description: 'Data schema of the extra term fields: JSON, @file or -', exclusive: ['clear-term-fields']}),
    'term-form': Flags.string({description: 'Form layout (UI schema) of the term fields: JSON, @file or -', exclusive: ['clear-term-fields']}),
    'clear-term-fields': Flags.boolean({description: 'Remove the extra term fields (both schemas)', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(DbTaxonomySave)
    if (!flags.id && !flags.name) throw usageError('A new taxonomy needs --name.', 'To change an existing one, pass --id.')

    const changes: Record<string, unknown> = {}
    if (flags.name !== undefined) changes.taxonomyName = flags.name
    if (flags.description !== undefined) changes.description = flags.description
    if (flags['clear-description']) changes.description = undefined
    if (flags.parent !== undefined) changes.parentId = flags.parent
    if (flags['clear-parent']) changes.parentId = undefined
    const dependsOn = listOf(flags['depends-on'])
    if (dependsOn) changes.dependencies = dependsOn
    if (flags['clear-depends-on']) changes.dependencies = []
    for (const [flag, field] of [
      ['term-fields', 'termsMetaDataSchema'],
      ['term-form', 'termsMetaVisualSchema'],
    ] as const) {
      const value = flags[flag]
      if (value !== undefined) changes[field] = await readJsonText(value, flag)
      if (flags['clear-term-fields']) changes[field] = undefined
    }

    if (flags.id && Object.keys(changes).length === 0) {
      throw usageError('Pass at least one change, e.g. --description "…".')
    }

    const client = this.client(flags)
    let current: Record<string, unknown> = {}
    if (flags.id && !flags['dry-run']) {
      const read = await client.hub.database.getDatabaseTaxonomy({id: flags.id})
      if (!read?.item) throw nothingRead(`taxonomy ${flags.id}`, 'Check the taxonomy id (txn_…), the project and --env.')
      current = storedTaxonomy(read.item as unknown as Record<string, unknown>)
    }

    const res = await client.hub.database.saveDatabaseTaxonomy({...current, ...changes, viewId: flags.id} as never)

    this.print(res)
    return res
  }
}

/** A taxonomy as `db taxonomy <id>` reads it, in the shape the save takes back. */
function storedTaxonomy(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {taxonomyName: item.name}
  if (typeof item.description === 'string') out.description = item.description
  if (typeof item.parentId === 'string' && item.parentId !== '') out.parentId = item.parentId
  if (Array.isArray(item.dependencies)) out.dependencies = item.dependencies
  // The read gives the term schemas as {json, fields}; the save takes the JSON text.
  const json = (v: unknown) => (typeof v === 'object' && v !== null ? (v as {json?: unknown}).json : undefined)
  const data = json(item.termsMetaDataSchema)
  const visual = json(item.termsMetaVisualSchema)
  if (typeof data === 'string' && data !== '') out.termsMetaDataSchema = data
  if (typeof visual === 'string' && visual !== '') out.termsMetaVisualSchema = visual
  return out
}
