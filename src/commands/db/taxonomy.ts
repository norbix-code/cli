import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class DbTaxonomy extends BaseCommand {
  static description = 'Show one database taxonomy'

  static examples = ['<%= config.bin %> db taxonomy 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Taxonomy ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTaxonomy)
    const client = this.client(flags)

    const res = await client.hub.database.getDatabaseTaxonomy({id: args.id})

    this.print(res)
    return res
  }
}
