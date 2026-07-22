import {Args} from '@oclif/core'
import {writeFile} from 'node:fs/promises'
import {basename} from 'node:path'

import {BaseCommand} from '../../base.js'
import {integrationFlag, resolveIntegration} from '../../lib/files.js'

export default class FilesDownload extends BaseCommand {
  static description = 'Download a file to disk (via a signed URL)'

  static examples = [
    '<%= config.bin %> files download invoices/2026/invoice.pdf',
    '<%= config.bin %> files download invoices/2026/invoice.pdf ./local-copy.pdf',
  ]

  static args = {
    remote: Args.string({required: true, description: 'Remote file path'}),
    file: Args.string({
      required: false,
      description: 'Local target file (default: remote file name in current folder)',
    }),
  }

  static flags = {
    integration: integrationFlag,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesDownload)
    const client = this.client(flags)
    const integration = resolveIntegration(flags.integration, this.resolveContext(flags).filesIntegrationId)
    if (!integration) {
      this.error('No files integration ID. Pass --integration or run `norbix config set filesIntegrationId <id>`.')
    }

    const {url} = await client.api.files.getSignedUrl({
      filesIntegrationId: integration,
      path: args.remote,
    })
    if (!url) this.error('Backend did not return a download URL.')

    const res = await fetch(url)
    if (!res.ok) this.error(`Download failed: HTTP ${res.status} ${res.statusText}`)

    const target = args.file ?? basename(args.remote)
    const bytes = Buffer.from(await res.arrayBuffer())
    await writeFile(target, bytes)

    const result = {path: args.remote, savedTo: target, sizeBytes: bytes.length}
    this.print(`Downloaded ${args.remote} → ${target} (${bytes.length} bytes).`)
    return result
  }
}
