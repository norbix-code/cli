import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {integrationFlag, resolveIntegration} from '../../lib/files.js'

export default class FilesInfo extends BaseCommand {
  static description = 'Show metadata for one file'

  static examples = ['<%= config.bin %> files info invoices/2026/invoice.pdf']

  static args = {
    remote: Args.string({required: true, description: 'Remote file path'}),
  }

  static flags = {
    integration: integrationFlag,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesInfo)
    const client = this.client(flags)
    const integration = resolveIntegration(flags.integration, this.resolveContext(flags).filesIntegrationId)
    if (!integration) {
      this.error('No files integration ID. Pass --integration or run `norbix config set filesIntegrationId <id>`.')
    }

    const res = await client.api.files.getFileInfo({
      filesIntegrationId: integration,
      path: args.remote,
    })

    this.print(res)
    return res
  }
}
