import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {usageError} from '../../../lib/cli-error.js'
import {readJsonText} from '../../../lib/database.js'
import {READ_FIRST_DRY_RUN, nothingRead} from '../../../lib/membership.js'

export default class DbAggregatesSave extends BaseCommand {
  static description = `Create or update a saved database aggregate

Without --id it creates one: --name and --pipeline are required. With --id it
updates that aggregate: the gateway replaces the name, the description and the
pipeline together, so the command reads the aggregate first and changes only
what you pass.

--pipeline is a JSON array of stages (inline, @file or -); {TokenKey}
placeholders are filled when it runs. Write stages ($out, $merge) are refused,
and you need read access to every collection it joins. Try a pipeline first
with \`db aggregates test\`.

${READ_FIRST_DRY_RUN}`

  static examples = [
    '<%= config.bin %> db aggregates save --schema sch_7lPCzWonEvTQsheGDCaKq --name Totals --pipeline \'[{"$count":"n"}]\'',
    '<%= config.bin %> db aggregates save --schema sch_7lPCzWonEvTQsheGDCaKq --id agg_1 --pipeline @totals.json',
    '<%= config.bin %> db aggregates save --schema sch_7lPCzWonEvTQsheGDCaKq --id agg_1 --name "Daily totals" --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    schema: Flags.string({required: true, description: 'Schema ID (sch_…) the aggregate belongs to'}),
    id: Flags.string({description: 'Aggregate ID — set it to update instead of create'}),
    name: Flags.string({description: 'Display name'}),
    description: Flags.string({description: 'What the aggregate does', exclusive: ['clear-description']}),
    'clear-description': Flags.boolean({description: 'Remove the description', default: false}),
    pipeline: Flags.string({description: 'MongoDB pipeline: a JSON array, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(DbAggregatesSave)
    if (!flags.id && (!flags.name || !flags.pipeline)) {
      throw usageError('A new aggregate needs --name and --pipeline.', 'To change an existing one, pass --id.')
    }

    if (flags.id && flags.name === undefined && flags.description === undefined && !flags['clear-description'] && flags.pipeline === undefined) {
      throw usageError('Pass at least one change: --name, --description or --pipeline.')
    }

    const changes: Record<string, unknown> = {}
    if (flags.name !== undefined) changes.displayName = flags.name
    if (flags.description !== undefined) changes.description = flags.description
    if (flags['clear-description']) changes.description = undefined
    if (flags.pipeline !== undefined) changes.pipeline = await readJsonText(flags.pipeline, 'pipeline')

    const client = this.client(flags)
    let current: Record<string, unknown> = {}
    if (flags.id && !flags['dry-run']) {
      const read = await client.hub.database.getDatabaseAggregate({id: flags.id, schemaId: flags.schema})
      if (!read?.item) throw nothingRead(`aggregate ${flags.id}`, 'Check the aggregate id, --schema, the project and --env.')
      const item = read.item as unknown as Record<string, unknown>
      current = {displayName: item.displayName, pipeline: item.pipeline}
      if (typeof item.description === 'string') current.description = item.description
    }

    const res = await client.hub.database.saveDatabaseAggregate({
      ...current,
      ...changes,
      schemaId: flags.schema,
      viewId: flags.id,
    } as never)

    this.print(res)
    return res
  }
}
