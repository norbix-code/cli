import {Args, Flags} from '@oclif/core'

import {AiChatCommand} from '../../../lib/ai-chat.js'

export default class AiChatArchive extends AiChatCommand {
  static description = 'Archive one of your developer AI chats (--undo: the opposite)'

  static examples = [
    '<%= config.bin %> ai chat archive aics_123',
    '<%= config.bin %> ai chat archive aics_123 --undo',
    '<%= config.bin %> ai chat archive aics_123 --dry-run',
  ]

  static args = {
    session: Args.string({required: true, description: 'Chat id (aics_…)'}),
  }

  static flags = {
    undo: Flags.boolean({description: 'Unarchive it instead', default: false}),
    ...AiChatCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiChatArchive)
    const client = this.accountClient(flags)

    const res = await client.hub.account.setChatSessionArchived({sessionId: args.session, archived: !flags.undo})

    this.print(`Chat ${args.session} ${flags.undo ? 'unarchived' : 'archived'}.`)
    return res
  }
}
