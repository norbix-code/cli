import {readFileSync} from 'node:fs'
import {basename, extname} from 'node:path'

import {Args, Flags} from '@oclif/core'

import {AiChatCommand} from '../../../lib/ai-chat.js'
import {usageError} from '../../../lib/cli-error.js'

const TYPES: Record<string, string> = {
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain',
}

export default class AiChatAttach extends AiChatCommand {
  static description = `Put a file into a developer AI chat, for the next message to use

Without --session a new chat starts (then --surface and --topic describe it,
and the project and env ride along as for \`ai chat\`). Prints the attachment
id and the chat id.`

  static examples = [
    '<%= config.bin %> ai chat attach ./orders.csv --session aics_123',
    '<%= config.bin %> ai chat attach ./spec.md --content-type text/markdown --prod',
    '<%= config.bin %> ai chat attach ./orders.csv --session aics_123 --dry-run',
  ]

  static args = {
    file: Args.string({required: true, description: 'Path of the file'}),
  }

  static flags = {
    session: Flags.string({description: 'The chat (aics_…); empty starts a new one'}),
    'content-type': Flags.string({description: 'MIME type (default: from the file extension)'}),
    surface: Flags.string({description: 'Surface (chat profile) of a new chat', default: 'assistant'}),
    topic: Flags.string({description: 'Topic hint of a new chat'}),
    ...AiChatCommand.accountFlag,
    ...AiChatCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiChatAttach)
    const contentType = flags['content-type'] ?? TYPES[extname(args.file).toLowerCase()]
    if (!contentType) throw usageError(`No content type for ${basename(args.file)}.`, 'Pass --content-type.', 'norbix ai chat attach --help')
    let content: Buffer
    try {
      content = readFileSync(args.file)
    } catch {
      throw usageError(`Cannot read ${args.file}.`, 'Check the path.', 'norbix ai chat attach --help')
    }

    const {client, scope} = flags.session ? {client: this.accountClient(flags), scope: {}} : this.scopedClient(flags)
    const res = await client.hub.account.uploadChatAttachment({
      sessionId: flags.session,
      fileName: basename(args.file),
      contentType,
      base64Content: content.toString('base64'),
      profile: flags.session ? undefined : flags.surface,
      topic: flags.session ? undefined : flags.topic,
      ...scope,
    })

    this.print(res)
    return res
  }
}
