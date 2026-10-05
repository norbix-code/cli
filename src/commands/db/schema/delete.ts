import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbSchemaDelete extends BaseCommand {
  static description = 'Delete a database schema'

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

    await this.confirmOrFail(`Delete schema ${args.id}?`, flags)

    const res = await client.hub.database.deleteDatabaseSchema({id: args.id})

    this.print(`Schema ${args.id} deleted.`)
    return res
  }
}
