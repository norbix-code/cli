import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class FilesIntegrationDefault extends BaseCommand {
  static description = 'Make a files integration the default one for this project'

  static examples = [
    '<%= config.bin %> files integration default 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> files integration default 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesIntegrationDefault)
    const client = this.client(flags)

    // The route token is `{Id}`; the SDK fills it from `id` (the lookup is
    // case-insensitive), so the generated field is enough.
    const res = await client.hub.files.setFilesIntegrationAsDefault({id: args.id})

    this.print(`Integration ${args.id} is now the default.`)
    return res
  }
}
