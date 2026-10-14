import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {integrationFlag} from '../../lib/files.js'

export default class FilesList extends BaseCommand {
  static description = 'List files in a folder of a files integration'

  static examples = [
    '<%= config.bin %> files list --integration 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> files list invoices/2026',
  ]

  static args = {
    path: Args.string({required: false, description: 'Folder path (default: root)'}),
  }

  static flags = {
    integration: integrationFlag,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesList)
    const client = this.client(flags)
    const integration = await this.filesIntegration(flags)

    const res = await client.api.files.listFiles({
      filesIntegrationId: integration,
      path: args.path,
    })

    this.print(res)
    return res
  }
}
