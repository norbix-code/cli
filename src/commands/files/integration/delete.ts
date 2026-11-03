import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class FilesIntegrationDelete extends BaseCommand {
  static description = 'Delete a files integration'

  static examples = [
    '<%= config.bin %> files integration delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> files integration delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesIntegrationDelete)
    const client = this.client(flags)
    await this.confirmOrFail(`Delete files integration ${args.id}?`, flags)

    // The route token is `{Id}`; the SDK fills it from `id` (the lookup is
    // case-insensitive), so the generated field is enough.
    const res = await client.hub.files.deleteFilesIntegration({id: args.id})

    this.print(`Integration ${args.id} deleted.`)
    return res
  }
}
