import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbSchemaListSettings extends BaseCommand {
  static description = `Show how the records list of a schema looks

columns (in order; fields not listed are hidden; primary = the column that
opens the record, linkReference = reference values open the referenced item),
defaultSort {field, order 1|-1} and filters (the fields offered in the filter
form). Each environment keeps its own layout (--env). No settings at all means
"show every field". Change them with \`db schema list-settings set\`.`

  static examples = [
    '<%= config.bin %> db schema list-settings sch_7lPCzWonEvTQsheGDCaKq',
    '<%= config.bin %> db schema list-settings sch_7lPCzWonEvTQsheGDCaKq --env TEST --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'Schema ID (sch_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchemaListSettings)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseSchemaListSettings({id: args.id})

    this.print(res)
    return res
  }
}
