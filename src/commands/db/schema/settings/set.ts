import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {usageError} from '../../../../lib/cli-error.js'
import {READ_FIRST_DRY_RUN, boolFlag, boolOf, listOf, nothingRead} from '../../../../lib/membership.js'

export default class DbSchemaSettingsSet extends BaseCommand {
  static description = `Change the settings of a database schema

The gateway replaces softDelete, hasRecordOwner and description together (a
value left out is turned off or cleared), so the command reads the schema
first and changes only what you pass. uniqueIndexes and endUserOwnRecords are
kept by the gateway when they are not sent.

--unique takes one combination of 2-5 fields, comma separated; repeat it for
more (at most 4). It replaces every stored combination; --clear-unique removes
them all. --own-records true needs --record-owner true (stored or sent).

${READ_FIRST_DRY_RUN}`

  static examples = [
    '<%= config.bin %> db schema settings set sch_7lPCzWonEvTQsheGDCaKq --soft-delete true',
    '<%= config.bin %> db schema settings set sch_7lPCzWonEvTQsheGDCaKq --record-owner true --own-records true',
    '<%= config.bin %> db schema settings set sch_7lPCzWonEvTQsheGDCaKq --unique childId,date --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Schema ID (sch_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    'soft-delete': boolFlag('Keep deleted records (hidden) instead of removing them'),
    'record-owner': boolFlag('Records carry the user who owns them'),
    'own-records': boolFlag('Signed-in users may add records and change the ones they made'),
    description: Flags.string({description: 'Short description', exclusive: ['clear-description']}),
    'clear-description': Flags.boolean({description: 'Remove the description', default: false}),
    unique: Flags.string({description: 'One unique field combination, comma separated (repeatable)', multiple: true, exclusive: ['clear-unique']}),
    'clear-unique': Flags.boolean({description: 'Remove every unique field combination', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchemaSettingsSet)
    const changes: Record<string, unknown> = {}
    const softDelete = boolOf(flags['soft-delete'])
    const recordOwner = boolOf(flags['record-owner'])
    const ownRecords = boolOf(flags['own-records'])
    if (softDelete !== undefined) changes.softDelete = softDelete
    if (recordOwner !== undefined) changes.hasRecordOwner = recordOwner
    if (ownRecords !== undefined) changes.endUserOwnRecords = ownRecords
    if (flags.description !== undefined) changes.description = flags.description
    if (flags['clear-description']) changes.description = undefined
    if (flags['clear-unique']) changes.uniqueIndexes = []
    if (flags.unique) changes.uniqueIndexes = flags.unique.map((u) => ({fields: listOf([u]) ?? []}))
    if (Object.keys(changes).length === 0) {
      throw usageError('Pass at least one setting to change, e.g. --soft-delete true.')
    }

    const client = this.client(flags)
    let current: Record<string, unknown> = {}
    if (!flags['dry-run']) {
      const read = await client.hub.database.getDatabaseSchema({id: args.id})
      if (!read?.item) throw nothingRead(`schema ${args.id}`, 'Check the schema id (sch_…), the project and --env.')
      const stored = (read.item.settings ?? {}) as Record<string, unknown>
      // Only the replaced fields are resent; uniqueIndexes / endUserOwnRecords
      // left out keep their stored value on the gateway.
      current = {softDelete: stored.softDelete ?? false, hasRecordOwner: stored.hasRecordOwner ?? false}
      if (typeof stored.description === 'string') current.description = stored.description
    }

    const settings = {...current, ...changes}
    const res = await client.hub.database.updateDatabaseSchemaSettings({id: args.id, settings} as never)
    this.print(`Settings of schema ${args.id} saved.`)
    return res
  }
}
