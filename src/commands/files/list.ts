import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {integrationFlag, resolveIntegration} from '../../lib/files.js'

export default class FilesList extends BaseCommand {
  static description = 'List files in a folder of a files integration'

  static examples = [
    '<%= config.bin %> files list --integration 66b2...',
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
    const integration = resolveIntegration(flags.integration, this.resolveContext(flags).filesIntegrationId)
    if (!integration) {
      this.error('No files integration ID. Pass --integration or run `norbix config set filesIntegrationId <id>`.')
    }

    const res = await client.api.files.listFiles({
      filesIntegrationId: integration,
      path: args.path,
    })

    this.print(res)
    return res
  }
}
