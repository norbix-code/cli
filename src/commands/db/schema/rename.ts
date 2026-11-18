import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbSchemaRename extends BaseCommand {
  static description = `Rename a database schema

Send the title people see (e.g. "Customer orders"); the server derives the
collection name (slug) from it. A title another schema already has is
refused. Records keep their data.`

  static examples = [
    '<%= config.bin %> db schema rename sch_7lPCzWonEvTQsheGDCaKq --title Orders',
    '<%= config.bin %> db schema rename sch_7lPCzWonEvTQsheGDCaKq --title Orders --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Schema ID (sch_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    title: Flags.string({required: true, description: 'New title; the collection name is derived from it'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchemaRename)
    const client = this.client(flags)

    const res = await client.hub.database.renameDatabaseSchema({id: args.id, title: flags.title})

    this.print(`Schema ${args.id} renamed to "${flags.title}".`)
    return res
  }
}
