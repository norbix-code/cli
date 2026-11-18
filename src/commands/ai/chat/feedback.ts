import {Args} from '@oclif/core'

import {AiChatCommand} from '../../../lib/ai-chat.js'

export default class AiChatFeedback extends AiChatCommand {
  static description = 'Like (up) or dislike (down) one entry of a chat, or clear it'

  static examples = [
    '<%= config.bin %> ai chat feedback aics_123 ent_456 up',
    '<%= config.bin %> ai chat feedback aics_123 ent_456 clear',
    '<%= config.bin %> ai chat feedback aics_123 ent_456 down --dry-run',
  ]

  static args = {
    session: Args.string({required: true, description: 'Chat id (aics_…)'}),
    entry: Args.string({required: true, description: 'Entry id (ent_…)'}),
    feedback: Args.string({required: true, options: ['up', 'down', 'clear'], description: 'up, down or clear'}),
  }

  static flags = {
    ...AiChatCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiChatFeedback)
    const client = this.accountClient(flags)

    const res = await client.hub.account.setChatEntryFeedback({
      sessionId: args.session,
      entryId: args.entry,
      feedback: args.feedback === 'clear' ? '' : args.feedback,
    })

    this.print(res)
    return res
  }
}
