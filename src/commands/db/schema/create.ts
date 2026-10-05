import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {fileSource, readJsonObject, readJsonText, type SchemaSettings} from '../../../lib/database.js'

export default class DbSchemaCreate extends BaseCommand {
  static description = `Create a database schema (a collection) from a JSON file

--file is the data schema (JSON Schema of one record). --ui-file is the
optional UI schema the dashboard form uses. The schema starts as a draft:
run \`db schema publish <id>\` to make the collection usable.`

  static examples = [
    '<%= config.bin %> db schema create --name orders --file orders.schema.json',
    '<%= config.bin %> db schema create --name orders --file orders.schema.json --ui-file orders.ui.json',
    '<%= config.bin %> db schema create --name orders --file orders.schema.json --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    name: Flags.string({required: true, description: 'Schema (collection) name'}),
    file: Flags.string({required: true, description: 'Data schema JSON file (or `-` for stdin)'}),
    'ui-file': Flags.string({description: 'UI schema JSON file'}),
    settings: Flags.string({description: 'Schema settings as a JSON object — inline, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(DbSchemaCreate)
    const client = this.client(flags)

    const res = await client.hub.database.saveDatabaseSchema({
      schemaName: flags.name,
      dataSchema: await readJsonText(fileSource(flags.file), 'file'),
      visualSchema: flags['ui-file'] ? await readJsonText(fileSource(flags['ui-file']), 'ui-file') : undefined,
      // The server validates the settings; the file may hold only some of them.
      settings: flags.settings ? ((await readJsonObject(flags.settings, 'settings')) as unknown as SchemaSettings) : undefined,
    })

    this.print(res)
    return res
  }
}

