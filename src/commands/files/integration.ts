import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class FilesIntegration extends BaseCommand {
  static description = 'Show one files integration'

  static examples = ['<%= config.bin %> files integration 66b2f0a1c3d4e5f6a7b8c9d0']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesIntegration)
    const client = this.client(flags)

    const res = await client.hub.files.getFilesIntegration({id: args.id})

    this.print(res)
    return res
  }
}
