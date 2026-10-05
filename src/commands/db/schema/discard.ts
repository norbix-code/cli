import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbSchemaDiscard extends BaseCommand {
  static description = 'Throw away the unpublished draft of a database schema'

  static examples = [
    '<%= config.bin %> db schema discard 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> db schema discard 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Schema ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchemaDiscard)
    const client = this.client(flags)

    await this.confirmOrFail(`Discard the draft of schema ${args.id}?`, flags)

    const res = await client.hub.database.discardDatabaseSchemaDraft({id: args.id})

    this.print(`Draft of schema ${args.id} discarded.`)
    return res
  }
}
