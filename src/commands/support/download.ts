import {Args, Flags} from '@oclif/core'
import {writeFile} from 'node:fs/promises'
import {basename} from 'node:path'

import {BaseCommand} from '../../base.js'

export default class SupportDownload extends BaseCommand {
  static description = 'Save one file of a support case to disk'

  static examples = [
    '<%= config.bin %> support download sup_1o5A0SxVXzWo9yqOfmQf8F supf_3kQ0x…',
    '<%= config.bin %> support download sup_1o5A0SxVXzWo9yqOfmQf8F supf_3kQ0x… --out ./reply.pdf',
  ]

  static args = {
    caseId: Args.string({required: true, description: 'Support case id (sup_…)'}),
    attachmentId: Args.string({required: true, description: 'File id (supf_…), from `norbix support attachments`'}),
  }

  static flags = {
    out: Flags.string({description: "Where to save it (default: the file's own name in this folder)"}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SupportDownload)
    const client = this.client(flags)

    let target = flags.out
    if (!target) {
      // The file's own name, from the list (the download answers bytes only).
      const list = await client.hub.support.getSupportCaseAttachments({caseId: args.caseId})
      const own = list?.result?.find((a) => a.id === args.attachmentId)?.fileName
      target = basename(own || args.attachmentId)
    }

    const bytes = await client.hub.support.downloadSupportCaseAttachment({caseId: args.caseId, attachmentId: args.attachmentId})
    await writeFile(target, bytes)

    const result = {caseId: args.caseId, attachmentId: args.attachmentId, savedTo: target, sizeBytes: bytes.length}
    this.print(`Saved ${args.attachmentId} → ${target} (${bytes.length} bytes).`)
    return result
  }
}
