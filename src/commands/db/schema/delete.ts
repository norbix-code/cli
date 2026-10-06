import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbSchemaDelete extends BaseCommand {
  static description = `Delete a database schema and its records

The schema's records (its collection, with its indexes) in this environment are
dropped too, and removed from the AI knowledge when AI embed is on. There is no
undo. The delete is refused while a schema trigger (CM-ERRORS-SCHEMA-017) or a
saved aggregate (CM-ERRORS-SCHEMA-018) uses the schema; then nothing is dropped.`

  static examples = [
    '<%= config.bin %> db schema delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> db schema delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Schema ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchemaDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete schema ${args.id} and all its records in this environment?`, flags)

    const res = await client.hub.database.deleteDatabaseSchema({id: args.id})

    this.print(`Schema ${args.id} deleted.`)
    return res
  }
}
