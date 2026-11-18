import {Args} from '@oclif/core'

import {AiChatCommand} from '../../../lib/ai-chat.js'

export default class AiChatSharing extends AiChatCommand {
  static description = `Keep one chat out of the shared improvement data, or let it in again

private: the chat is not shared. shared: it may be used again (the default of a new chat).`

  static examples = [
    '<%= config.bin %> ai chat sharing aics_123 private',
    '<%= config.bin %> ai chat sharing aics_123 shared',
    '<%= config.bin %> ai chat sharing aics_123 private --dry-run',
  ]

  static args = {
    session: Args.string({required: true, description: 'Chat id (aics_…)'}),
    state: Args.string({required: true, options: ['private', 'shared'], description: 'private or shared'}),
  }

  static flags = {
    ...AiChatCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiChatSharing)
    const client = this.accountClient(flags)

    const res = await client.hub.account.setChatSessionSharing({sessionId: args.session, doNotShare: args.state === 'private'})

    this.print(`Chat ${args.session} is ${args.state}.`)
    return res
  }
}
