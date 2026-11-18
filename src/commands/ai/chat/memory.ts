import {AiChatCommand} from '../../../lib/ai-chat.js'

export default class AiChatMemory extends AiChatCommand {
  static description = `List what the assistant remembers (its memory notes)

With a project set, the list is filtered to that project; --account-level
lists them without the filter.`

  static examples = ['<%= config.bin %> ai chat memory', '<%= config.bin %> ai chat memory --account-level']

  static flags = {
    ...AiChatCommand.accountFlag,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiChatMemory)
    const ctx = this.resolveContext(flags)
    const client = this.accountClient(flags)

    const res = await client.hub.account.getChatMemory({projectId: flags['account-level'] ? undefined : ctx.projectId})

    this.print(res)
    return res
  }
}
