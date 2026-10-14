import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {integrationFlag} from '../../lib/files.js'

export default class FilesDelete extends BaseCommand {
  static description = 'Delete one file'

  static examples = [
    '<%= config.bin %> files delete invoices/2026/invoice.pdf --yes',
    '<%= config.bin %> files delete invoices/2026/invoice.pdf --dry-run',
  ]

  static args = {
    remote: Args.string({required: true, description: 'Remote file path'}),
  }

  static flags = {
    integration: integrationFlag,
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesDelete)
    const client = this.client(flags)
    const integration = await this.filesIntegration(flags)

    await this.confirmOrFail(`Delete file "${args.remote}"?`, flags)

    const res = await client.api.files.deleteFileApi({
      filesIntegrationId: integration,
      path: args.remote,
    })

    this.print(`Deleted ${args.remote}.`)
    return res
  }
}
