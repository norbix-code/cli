import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {integrationFlag, resolveIntegration} from '../../lib/files.js'

export default class FilesSign extends BaseCommand {
  static description = 'Get a temporary signed download URL for a file'

  static examples = ['<%= config.bin %> files sign invoices/2026/invoice.pdf --expires 3600']

  static args = {
    remote: Args.string({required: true, description: 'Remote file path'}),
  }

  static flags = {
    integration: integrationFlag,
    expires: Flags.integer({description: 'URL lifetime in seconds'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesSign)
    const client = this.client(flags)
    const integration = resolveIntegration(flags.integration, this.resolveContext(flags).filesIntegrationId)
    if (!integration) {
      this.error('No files integration ID. Pass --integration or run `norbix config set filesIntegrationId <id>`.')
    }

    const res = await client.api.files.getSignedUrl({
      filesIntegrationId: integration,
      path: args.remote,
      expirationSeconds: flags.expires,
    })

    this.print(res.url ?? res)
    return res
  }
}
