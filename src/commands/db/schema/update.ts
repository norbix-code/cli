import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {fileSource, readJsonText} from '../../../lib/database.js'

export default class DbSchemaUpdate extends BaseCommand {
  static description = `Change a database schema from a JSON file

The change is saved as the schema's draft; records keep using the published
version until you run \`db schema publish <id>\`. \`db schema draft <id>\` shows
the draft, \`db schema discard <id>\` throws it away.`

  static examples = [
    '<%= config.bin %> db schema update 66b2f0a1c3d4e5f6a7b8c9d0 --file orders.schema.json',
    '<%= config.bin %> db schema update 66b2f0a1c3d4e5f6a7b8c9d0 --ui-file orders.ui.json',
    '<%= config.bin %> db schema update 66b2f0a1c3d4e5f6a7b8c9d0 --file orders.schema.json --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Schema ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    file: Flags.string({description: 'Data schema JSON file (or `-` for stdin)'}),
    'ui-file': Flags.string({description: 'UI schema JSON file'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchemaUpdate)
    if (!flags.file && !flags['ui-file']) this.error('Pass --file, --ui-file, or both.')
    const client = this.client(flags)

    const res = await client.hub.database.updateDatabaseSchemaDraft({
      id: args.id,
      dataSchema: flags.file ? await readJsonText(fileSource(flags.file), 'file') : undefined,
      visualSchema: flags['ui-file'] ? await readJsonText(fileSource(flags['ui-file']), 'ui-file') : undefined,
    })

    this.print(`Draft of schema ${args.id} saved. Publish it with: norbix db schema publish ${args.id}`)
    return res
  }
}
