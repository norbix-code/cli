import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {integrationFlag, resolveIntegration} from '../../lib/files.js'
import {callPublicFiles, publicUrlFor} from '../../lib/publicFiles.js'

export default class FilesPublish extends BaseCommand {
  static args = {
    remote: Args.string({description: 'Remote file path, or folder prefix with --folder', required: true}),
  }

  static description =
    'Make a file (or a whole folder) readable by anyone holding its link — no sign-in needed'

  static examples = [
    '<%= config.bin %> files publish invoices/2026/invoice.pdf',
    '<%= config.bin %> files publish invoices --folder',
  ]

  static flags = {
    folder: Flags.boolean({
      description: 'Publish the whole folder prefix instead of one file',
    }),
    integration: integrationFlag,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesPublish)
    const ctx = this.resolveContext(flags)
    // Builds nothing itself, but it is what refuses early and with a useful
    // sentence when there is no project or no credentials.
    this.client(flags)

    const integration = resolveIntegration(flags.integration, ctx.filesIntegrationId)
    if (!integration) {
      this.error('No files integration ID. Pass --integration or run `norbix config set filesIntegrationId <id>`.')
    }

    const result = await callPublicFiles(
      ctx,
      flags.folder ? 'makeFolderPublic' : 'makeFilePublic',
      {filesIntegrationId: integration, path: args.remote},
    )

    if (!result.id) {
      this.error('The gateway did not return a public id.')
    }

    const url = publicUrlFor(ctx.apiUrl, result.id, args.remote, flags.folder)
    this.print(url)
    return {publicId: result.id, publicUrl: url}
  }
}
