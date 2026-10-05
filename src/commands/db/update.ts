import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {readJsonInput} from '../../lib/json.js'
import {refuseEmptyFilter, refuseUpdateOperators} from '../../lib/records.js'

export default class DbUpdate extends BaseCommand {
  static description = `Update records: one by --id, many by --filter with --many, or every record with --all

--update is the plain fields to change, e.g. {"status":"paid"}; the gateway
applies them with $set. Operators ($set, $inc, …) are refused. An empty filter
('{}') is refused: it would change the whole collection. Use --all to do that
on purpose. Soft-deleted records are not changed.`

  static examples = [
    `<%= config.bin %> db update orders --id 66b2f0a1c3d4e5f6a7b8c9d0 --update '{"status":"shipped"}'`,
    `<%= config.bin %> db update orders --filter '{"status":"new"}' --update '{"status":"queued"}' --many --dry-run`,
    `<%= config.bin %> db update orders --filter '{"status":"new"}' --update '{"status":"queued"}' --many --yes`,
    `<%= config.bin %> db update orders --all --update '{"archived":true}' --dry-run`,
  ]

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
  }

  static flags = {
    id: Flags.string({description: 'Record ID (single update)', exclusive: ['many', 'filter', 'all']}),
    filter: Flags.string({char: 'f', description: 'JSON filter (with --many); must not be empty', dependsOn: ['many'], exclusive: ['all']}),
    update: Flags.string({char: 'u', required: true, description: 'JSON object of the fields to change (e.g. {"status":"paid"}) or `-` for stdin'}),
    many: Flags.boolean({description: 'Update every record matching --filter', default: false}),
    all: Flags.boolean({description: 'Update EVERY record of the collection (sends allRecords: true)', default: false}),
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbUpdate)
    const client = this.client(flags)
    const update = await readJsonInput(flags.update, 'update')
    refuseUpdateOperators(update)

    if (flags.all) {
      await this.confirmOrFail(`Update EVERY record in "${args.collection}" with ${update}?`, flags)
      const res = await client.api.database.updateMany({
        collectionName: args.collection,
        filter: '{}',
        allRecords: true,
        update,
      })
      this.print(res)
      return res
    }

    if (flags.many) {
      if (!flags.filter) this.error('--many requires --filter (or use --all to update every record).')
      const filter = await readJsonInput(flags.filter, 'filter')
      refuseEmptyFilter(filter, 'update')
      await this.confirmOrFail(`Update ALL records in "${args.collection}" matching ${filter}?`, flags)
      const res = await client.api.database.updateMany({
        collectionName: args.collection,
        filter,
        update,
      })
      this.print(res)
      return res
    }

    if (!flags.id) this.error('Pass --id for a single update, --filter with --many, or --all.')
    const res = await client.api.database.updateOne({
      collectionName: args.collection,
      id: flags.id,
      update,
    })
    this.print(res)
    return res
  }
}
