import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbSchemaPublish extends BaseCommand {
  static description = `Publish the draft of a database schema

Records are validated against the published version from now on. Check the
change first with \`db schema draft <id>\` or \`db schema diff\`.`

  static examples = [
    '<%= config.bin %> db schema publish 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> db schema publish 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Schema ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchemaPublish)
    const client = this.client(flags)

    await this.confirmOrFail(`Publish the draft of schema ${args.id}?`, flags)

    // `confirmed` is the server's own "yes, publish even a breaking change"
    // switch; the CLI asks first (or takes --yes), so it always sends true.
    const res = await client.hub.database.publishDatabaseSchema({id: args.id, confirmed: true})

    this.print(`Schema ${args.id} published.`)
    return res
  }
}
