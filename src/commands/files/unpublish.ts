import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {integrationFlag} from '../../lib/files.js'
import {callPublicFiles} from '../../lib/publicFiles.js'

export default class FilesUnpublish extends BaseCommand {
  static args = {
    remote: Args.string({description: 'Remote file path, or folder prefix with --folder', required: true}),
  }

  static description = "Take away a file's (or a folder's) public link"

  static examples = [
    '<%= config.bin %> files unpublish invoices/2026/invoice.pdf',
    '<%= config.bin %> files unpublish invoices --folder',
    '<%= config.bin %> files unpublish invoices/2026/invoice.pdf --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    folder: Flags.boolean({
      description: 'Unpublish the whole folder prefix, and every link inside it',
    }),
    integration: integrationFlag,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesUnpublish)
    const ctx = await this.freshContext(flags)
    const client = this.client(flags)

    const integration = await this.filesIntegration(flags)

    const operation = flags.folder ? 'makeFolderPrivate' : 'makeFilePrivate'
    const body = {filesIntegrationId: integration, path: args.remote}
    await callPublicFiles(client, operation, body)

    this.print(
      flags.folder
        ? `${args.remote} is private again — every link inside it is gone`
        : `${args.remote} is private again — its link now gives a 404`,
    )
    return {path: args.remote, public: false}
  }
}
