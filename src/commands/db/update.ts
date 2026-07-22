import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {readJsonInput} from '../../lib/json.js'

export default class DbUpdate extends BaseCommand {
  static description = 'Update records: one by --id, or many by --filter with --many'

  static examples = [
    `<%= config.bin %> db update orders --id 66b2f0a1... --update '{"$set":{"status":"shipped"}}'`,
    `<%= config.bin %> db update orders --filter '{"status":"new"}' --update '{"$set":{"status":"queued"}}' --many`,
  ]

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
  }

  static flags = {
    id: Flags.string({description: 'Record ID (single update)', exclusive: ['many', 'filter']}),
    filter: Flags.string({char: 'f', description: 'JSON filter (with --many)', dependsOn: ['many']}),
    update: Flags.string({char: 'u', required: true, description: 'JSON update (e.g. {"$set":{...}}) or `-` for stdin'}),
    many: Flags.boolean({description: 'Update every record matching --filter', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbUpdate)
    const client = this.client(flags)
    const update = await readJsonInput(flags.update, 'update')

    if (flags.many) {
      if (!flags.filter) this.error('--many requires --filter.')
      const res = await client.api.database.updateMany({
        collectionName: args.collection,
        filter: await readJsonInput(flags.filter, 'filter'),
        update,
      })
      this.print(res)
      return res
    }

    if (!flags.id) this.error('Pass --id for a single update, or --filter with --many.')
    const res = await client.api.database.updateOne({
      collectionName: args.collection,
      id: flags.id,
      update,
    })
    this.print(res)
    return res
  }
}
