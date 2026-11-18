import {Flags} from '@oclif/core'

import {AiChatCommand} from '../../../lib/ai-chat.js'

export default class AiChatSessions extends AiChatCommand {
  static description = 'List your developer AI chats, newest first'

  static examples = ['<%= config.bin %> ai chat sessions', '<%= config.bin %> ai chat sessions --take 50 --archived']

  static flags = {
    take: Flags.integer({description: 'How many'}),
    archived: Flags.boolean({description: 'Include archived chats', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiChatSessions)
    const client = this.accountClient(flags)

    const res = await client.hub.account.getChatSessions({
      take: flags.take,
      includeArchived: flags.archived || undefined,
    })

    this.print(res)
    return res
  }
}
