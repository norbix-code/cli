import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbSchemaSettings extends BaseCommand {
  static description = `Show the settings of a database schema

softDelete (deleted records are kept, hidden), hasRecordOwner (records carry
the user who owns them), description, uniqueIndexes (field combinations no two
records may share) and endUserOwnRecords (signed-in users may add their own
records). Read from the published schema; change them with
\`db schema settings set\`.`

  static examples = ['<%= config.bin %> db schema settings sch_7lPCzWonEvTQsheGDCaKq']

  static args = {
    id: Args.string({required: true, description: 'Schema ID (sch_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchemaSettings)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseSchema({id: args.id})
    const settings = res?.item?.settings ?? {}

    this.print(settings)
    return settings
  }
}
