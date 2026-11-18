import {Args} from '@oclif/core'

import {AiChatCommand} from '../../../lib/ai-chat.js'

export default class AiChatDelete extends AiChatCommand {
  static description = 'Delete one of your developer AI chats'

  static examples = ['<%= config.bin %> ai chat delete aics_123 --yes', '<%= config.bin %> ai chat delete aics_123 --dry-run']

  static args = {
    session: Args.string({required: true, description: 'Chat id (aics_…)'}),
  }

  static flags = {
    ...AiChatCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiChatDelete)
    const client = this.accountClient(flags)

    await this.confirmOrFail(`Delete AI chat ${args.session}?`, flags)

    const res = await client.hub.account.deleteChatSession({sessionId: args.session})

    this.print(`Chat ${args.session} deleted.`)
    return res
  }
}
