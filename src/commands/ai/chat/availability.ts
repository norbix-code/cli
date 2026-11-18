import {AiChatCommand} from '../../../lib/ai-chat.js'

export default class AiChatAvailability extends AiChatCommand {
  static description = 'Whether the developer AI chat can run here, why not, its profiles and models'

  static examples = ['<%= config.bin %> ai chat availability --prod', '<%= config.bin %> ai chat availability --account-level']

  static flags = {
    ...AiChatCommand.accountFlag,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiChatAvailability)
    const {client, scope} = this.scopedClient(flags)

    const res = await client.hub.account.chatAvailability({...scope})

    this.print(res)
    return res
  }
}
