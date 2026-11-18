import {Args} from '@oclif/core'

import {AiChatCommand} from '../../../lib/ai-chat.js'

export default class AiChatForget extends AiChatCommand {
  static description = 'Delete one memory note of the assistant'

  static examples = [
    '<%= config.bin %> ai chat forget mem_123 --yes',
    '<%= config.bin %> ai chat forget mem_123 --dry-run',
  ]

  static args = {
    note: Args.string({required: true, description: 'Memory note id (ai chat memory)'}),
  }

  static flags = {
    ...AiChatCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiChatForget)
    const client = this.accountClient(flags)

    await this.confirmOrFail(`Delete memory note ${args.note}?`, flags)

    const res = await client.hub.account.forgetChatMemory({noteId: args.note})

    this.print(`Memory note ${args.note} deleted.`)
    return res
  }
}
