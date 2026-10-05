import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class DbTrigger extends BaseCommand {
  static description = 'Show one schema trigger'

  static examples = ['<%= config.bin %> db trigger 66b2f0a1c3d4e5f6a7b8c9d0']

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  static flags = {
    schema: Flags.string({description: 'Schema ID the trigger belongs to'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTrigger)
    const client = this.client(flags)

    const res = await client.hub.database.getSchemaTrigger({id: args.id, schemaId: flags.schema})

    this.print(res)
    return res
  }
}
