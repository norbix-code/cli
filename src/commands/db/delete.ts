import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {readJsonInput} from '../../lib/json.js'
import {refuseEmptyFilter} from '../../lib/records.js'

export default class DbDelete extends BaseCommand {
  static description = `Delete records: one by --id, many by --filter with --many, or every record with --all

An empty filter ('{}') is refused: it would delete the whole collection. Use
--all to do that on purpose. A caller with only "delete own" rights deletes
only the records it owns.`

  static examples = [
    '<%= config.bin %> db delete orders --id 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
    '<%= config.bin %> db delete orders --id 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    `<%= config.bin %> db delete orders --filter '{"status":"cancelled"}' --many --yes`,
    '<%= config.bin %> db delete orders --all --dry-run',
  ]

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
  }

  static flags = {
    id: Flags.string({description: 'Record ID (single delete)', exclusive: ['many', 'filter', 'all']}),
    filter: Flags.string({char: 'f', description: 'JSON filter (with --many); must not be empty', dependsOn: ['many'], exclusive: ['all']}),
    many: Flags.boolean({description: 'Delete every record matching --filter', default: false}),
    all: Flags.boolean({description: 'Delete EVERY record of the collection (sends allRecords: true)', default: false}),
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbDelete)
    const client = this.client(flags)

    if (flags.all) {
      await this.confirmOrFail(`Delete EVERY record in "${args.collection}"?`, flags)
      const res = await client.api.database.deleteMany({collectionName: args.collection, filter: '{}', allRecords: true})
      this.print(res)
      return res
    }

    if (flags.many) {
      if (!flags.filter) this.error('--many requires --filter (or use --all to delete every record).')
      const filter = await readJsonInput(flags.filter, 'filter')
      refuseEmptyFilter(filter, 'delete')
      await this.confirmOrFail(`Delete ALL records in "${args.collection}" matching ${filter}?`, flags)

      const res = await client.api.database.deleteMany({collectionName: args.collection, filter})
      this.print(res)
      return res
    }

    if (!flags.id) this.error('Pass --id for a single delete, --filter with --many, or --all.')
    await this.confirmOrFail(`Delete record ${flags.id} from "${args.collection}"?`, flags)
    const res = await client.api.database.deleteOne({collectionName: args.collection, id: flags.id})
    this.print(res)
    return res
  }
}
