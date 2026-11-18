import {Args, Flags} from '@oclif/core'

import {AiChatCommand} from '../../../lib/ai-chat.js'

export default class AiChatPin extends AiChatCommand {
  static description = 'Pin one of your developer AI chats (--undo: the opposite)'

  static examples = [
    '<%= config.bin %> ai chat pin aics_123',
    '<%= config.bin %> ai chat pin aics_123 --undo',
    '<%= config.bin %> ai chat pin aics_123 --dry-run',
  ]

  static args = {
    session: Args.string({required: true, description: 'Chat id (aics_…)'}),
  }

  static flags = {
    undo: Flags.boolean({description: 'Unpin it instead', default: false}),
    ...AiChatCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiChatPin)
    const client = this.accountClient(flags)

    const res = await client.hub.account.setChatSessionPinned({sessionId: args.session, pinned: !flags.undo})

    this.print(`Chat ${args.session} ${flags.undo ? 'unpinned' : 'pinned'}.`)
    return res
  }
}
