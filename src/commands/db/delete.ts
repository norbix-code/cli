import {confirm} from '@inquirer/prompts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {readJsonInput} from '../../lib/json.js'

export default class DbDelete extends BaseCommand {
  static description = 'Delete records: one by --id, or many by --filter with --many'

  static examples = [
    '<%= config.bin %> db delete orders --id 66b2f0a1...',
    `<%= config.bin %> db delete orders --filter '{"status":"cancelled"}' --many --yes`,
  ]

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
  }

  static flags = {
    id: Flags.string({description: 'Record ID (single delete)', exclusive: ['many', 'filter']}),
    filter: Flags.string({char: 'f', description: 'JSON filter (with --many)', dependsOn: ['many']}),
    many: Flags.boolean({description: 'Delete every record matching --filter', default: false}),
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbDelete)
    const client = this.client(flags)

    if (flags.many) {
      if (!flags.filter) this.error('--many requires --filter.')
      const filter = await readJsonInput(flags.filter, 'filter')
      if (!flags.yes && process.stdout.isTTY) {
        const ok = await confirm({
          message: `Delete ALL records in "${args.collection}" matching ${filter}?`,
          default: false,
        })
        if (!ok) return this.print('Cancelled.')
      }

      const res = await client.api.database.deleteMany({collectionName: args.collection, filter})
      this.print(res)
      return res
    }

    if (!flags.id) this.error('Pass --id for a single delete, or --filter with --many.')
    const res = await client.api.database.deleteOne({collectionName: args.collection, id: flags.id})
    this.print(res)
    return res
  }
}
