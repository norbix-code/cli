import {Args, Flags} from '@oclif/core'

import {AiChatCommand} from '../../../lib/ai-chat.js'
import {usageError} from '../../../lib/cli-error.js'

export default class AiChatAnswer extends AiChatCommand {
  static description = `Answer a question the assistant asked in a chat

The question entry (ai chat entries) lists its question keys; give one
--answer key=value per question. The assistant goes on with the answers.`

  static examples = [
    '<%= config.bin %> ai chat answer aics_123 ent_456 --answer q1=Yes --answer q2="Only TEST"',
    '<%= config.bin %> ai chat answer aics_123 ent_456 --answer q1=Yes --dry-run',
  ]

  static args = {
    session: Args.string({required: true, description: 'Chat id (aics_…)'}),
    entry: Args.string({required: true, description: 'The question entry (ent_…)'}),
  }

  static flags = {
    answer: Flags.string({required: true, multiple: true, description: 'key=value, once per question'}),
    ...AiChatCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiChatAnswer)
    const answers: Record<string, string> = {}
    for (const pair of flags.answer) {
      const at = pair.indexOf('=')
      if (at <= 0) throw usageError(`--answer ${pair} is not key=value.`, 'Write --answer <question key>=<answer>.', 'norbix ai chat answer --help')
      answers[pair.slice(0, at)] = pair.slice(at + 1)
    }

    const client = this.accountClient(flags)
    const res = await client.hub.account.answerChatQuestion({sessionId: args.session, entryId: args.entry, answers})

    this.print(res)
    return res
  }
}
