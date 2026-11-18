import {Args, Flags} from '@oclif/core'

import {AiChatCommand} from '../../../lib/ai-chat.js'

export default class AiChatEntries extends AiChatCommand {
  static description = `Read the transcript of one chat: messages, plans, questions, steps

Each entry has an id (ent_…) and a sequence number; --since gives only the
entries after that number.`

  static examples = ['<%= config.bin %> ai chat entries aics_123', '<%= config.bin %> ai chat entries aics_123 --since 12']

  static args = {
    session: Args.string({required: true, description: 'Chat id (aics_…)'}),
  }

  static flags = {
    since: Flags.integer({description: 'Only the entries after this sequence number'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiChatEntries)
    const client = this.accountClient(flags)

    const res = await client.hub.account.getChatSessionEntries({sessionId: args.session, sinceSeq: flags.since})

    this.print(res)
    return res
  }
}
