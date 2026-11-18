import {Args} from '@oclif/core'

import {AiChatCommand} from '../../../lib/ai-chat.js'

export default class AiChatStop extends AiChatCommand {
  static description = `Stop a queued, running or waiting step of a chat plan run

The step ends failed (cancelled by you), the steps that depend on it are
blocked, and the assistant asks whether to retry, skip or fix.`

  static examples = [
    '<%= config.bin %> ai chat stop aics_123 ent_789 --yes',
    '<%= config.bin %> ai chat stop aics_123 ent_789 --dry-run',
  ]

  static args = {
    session: Args.string({required: true, description: 'Chat id (aics_…)'}),
    entry: Args.string({required: true, description: 'The step entry (ent_…)'}),
  }

  static flags = {
    ...AiChatCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiChatStop)
    const client = this.accountClient(flags)

    await this.confirmOrFail(`Stop step ${args.entry} of chat ${args.session}?`, flags)

    const res = await client.hub.account.stopChatRunStep({sessionId: args.session, entryId: args.entry})

    this.print(res)
    return res
  }
}
