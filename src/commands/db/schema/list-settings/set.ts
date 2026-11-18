import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {usageError} from '../../../../lib/cli-error.js'
import {readJsonObject} from '../../../../lib/database.js'
import {READ_FIRST_DRY_RUN, listOf, nothingRead} from '../../../../lib/membership.js'

interface Column {
  field: string
  primary?: boolean
  linkReference?: boolean
}

export default class DbSchemaListSettingsSet extends BaseCommand {
  static description = `Change how the records list of a schema looks

The gateway replaces the whole list layout at once, so the command reads it
first and changes only what you pass.

--columns sets the visible columns in order (a field id, or _id,
_meta.createdOn, _meta.modifiedOn); a column that was already there keeps its
linkReference. --primary marks the column that opens the record. --sort sets
the default sort (one of the columns), --desc sorts it descending. --filters
sets the fields of the filter form. --file replaces everything with a
{columns, defaultSort, filters} JSON object (inline, @file or -), e.g. the
"settings" of \`db schema list-settings <id> --json\`.

${READ_FIRST_DRY_RUN}`

  static examples = [
    '<%= config.bin %> db schema list-settings set sch_7lPCzWonEvTQsheGDCaKq --columns title,total,_meta.createdOn --primary title',
    '<%= config.bin %> db schema list-settings set sch_7lPCzWonEvTQsheGDCaKq --sort _meta.createdOn --desc',
    '<%= config.bin %> db schema list-settings set sch_7lPCzWonEvTQsheGDCaKq --file @list.json --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Schema ID (sch_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    columns: Flags.string({description: 'Visible columns in order, comma separated (repeatable)', multiple: true, exclusive: ['file']}),
    primary: Flags.string({description: 'The column whose cell opens the record', exclusive: ['file']}),
    sort: Flags.string({description: 'Default sort field (one of the columns)', exclusive: ['file']}),
    desc: Flags.boolean({description: 'Sort the default sort field descending (with --sort)', default: false}),
    filters: Flags.string({description: 'Fields of the filter form, comma separated (repeatable)', multiple: true, exclusive: ['file']}),
    file: Flags.string({description: 'The whole layout as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchemaListSettingsSet)
    const client = this.client(flags)

    if (flags.file) {
      const raw = await readJsonObject(flags.file, 'file')
      const settings = (typeof raw.settings === 'object' && raw.settings !== null ? raw.settings : raw) as Record<string, unknown>
      const res = await client.hub.database.updateDatabaseSchemaListSettings({id: args.id, settings} as never)
      this.print(`List settings of schema ${args.id} saved.`)
      return res
    }

    if (flags.desc && !flags.sort) throw usageError('--desc goes with --sort <field>.')

    const columns = listOf(flags.columns)
    const filters = listOf(flags.filters)
    if (!columns && !flags.primary && !flags.sort && !filters) {
      throw usageError('Pass at least one change, e.g. --columns title,total, or --file.')
    }

    let current: {columns?: Column[]; defaultSort?: {field: string; order: number}; filters?: string[]} = {}
    if (!flags['dry-run']) {
      const read = await client.hub.database.getDatabaseSchemaListSettings({id: args.id})
      if (!read) throw nothingRead(`list settings of schema ${args.id}`, 'Check the schema id (sch_…), the project and --env.')
      current = (read.settings ?? {}) as typeof current
    }

    const before = new Map((current.columns ?? []).map((c) => [c.field, c]))
    let next: Column[] = columns
      ? columns.map((field) => ({field, linkReference: before.get(field)?.linkReference ?? false, primary: before.get(field)?.primary ?? false}))
      : [...(current.columns ?? [])]
    if (flags.primary) {
      if (!next.some((c) => c.field === flags.primary)) next = [...next, {field: flags.primary}]
      next = next.map((c) => ({...c, primary: c.field === flags.primary}))
    }

    const settings: Record<string, unknown> = {...current, columns: next}
    if (flags.sort) settings.defaultSort = {field: flags.sort, order: flags.desc ? -1 : 1}
    if (filters) settings.filters = filters

    const res = await client.hub.database.updateDatabaseSchemaListSettings({id: args.id, settings} as never)
    this.print(`List settings of schema ${args.id} saved.`)
    return res
  }
}
