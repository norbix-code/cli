import {Args, Flags} from '@oclif/core'
import {readFile} from 'node:fs/promises'
import {basename} from 'node:path'

import {BaseCommand} from '../../base.js'
import {guessContentType, integrationFlag, resolveIntegration} from '../../lib/files.js'

export default class FilesUpload extends BaseCommand {
  static description = `Upload a local file (three steps: get signed URL, PUT bytes, commit).`

  static examples = [
    '<%= config.bin %> files upload ./invoice.pdf',
    '<%= config.bin %> files upload ./invoice.pdf invoices/2026/invoice.pdf',
  ]

  static args = {
    file: Args.string({required: true, description: 'Local file to upload'}),
    remote: Args.string({
      required: false,
      description: 'Remote path (default: file name in the root folder)',
    }),
  }

  static flags = {
    integration: integrationFlag,
    'content-type': Flags.string({description: 'MIME type (default: guessed from extension)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesUpload)
    const client = this.client(flags)
    const integration = resolveIntegration(flags.integration, this.resolveContext(flags).filesIntegrationId)
    if (!integration) {
      this.error('No files integration ID. Pass --integration or run `norbix config set filesIntegrationId <id>`.')
    }

    const data = await readFile(args.file)
    const fileName = basename(args.file)
    const remotePath = args.remote ?? fileName
    const contentType = flags['content-type'] ?? guessContentType(fileName)

    // 1. Ask the backend for a signed upload URL.
    const {url} = await client.api.files.requestUploadUrl({
      filesIntegrationId: integration,
      path: remotePath,
      contentType,
    })
    if (!url) this.error('Backend did not return an upload URL.')

    // 2. PUT the bytes straight to storage.
    const put = await fetch(url, {
      method: 'PUT',
      body: new Uint8Array(data),
      headers: {'Content-Type': contentType},
    })
    if (!put.ok) this.error(`Upload failed: HTTP ${put.status} ${put.statusText}`)

    // 3. Commit so the file becomes visible.
    await client.api.files.commitUpload({
      filesIntegrationId: integration,
      path: remotePath,
      contentType,
      sizeBytes: data.length,
      fileName,
    })

    const result = {path: remotePath, sizeBytes: data.length, contentType}
    this.print(`Uploaded ${args.file} → ${remotePath} (${data.length} bytes).`)
    return result
  }
}
