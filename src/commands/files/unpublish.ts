import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {integrationFlag, resolveIntegration} from '../../lib/files.js'
import {callPublicFiles} from '../../lib/publicFiles.js'

export default class FilesUnpublish extends BaseCommand {
  static args = {
    remote: Args.string({description: 'Remote file path, or folder prefix with --folder', required: true}),
  }

  static description = "Take away a file's (or a folder's) public link"

  static examples = [
    '<%= config.bin %> files unpublish invoices/2026/invoice.pdf',
    '<%= config.bin %> files unpublish invoices --folder',
  ]

  static flags = {
    folder: Flags.boolean({
      description: 'Unpublish the whole folder prefix, and every link inside it',
    }),
    integration: integrationFlag,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesUnpublish)
    const ctx = this.resolveContext(flags)
    this.client(flags)

    const integration = resolveIntegration(flags.integration, ctx.filesIntegrationId)
    if (!integration) {
      this.error('No files integration ID. Pass --integration or run `norbix config set filesIntegrationId <id>`.')
    }

    await callPublicFiles(
      ctx,
      flags.folder ? 'makeFolderPrivate' : 'makeFilePrivate',
      {filesIntegrationId: integration, path: args.remote},
    )

    this.print(
      flags.folder
        ? `${args.remote} is private again — every link inside it is gone`
        : `${args.remote} is private again — its link now gives a 404`,
    )
    return {path: args.remote, public: false}
  }
}
