import {Flags} from '@oclif/core'

import {AiChatCommand} from '../../lib/ai-chat.js'

export default class AiTools extends AiChatCommand {
  static description = `List the AI tools: the chat-tool inventory

Every tool the chat (and an MCP client) may call, with its toolsets, whether
it asks for confirmation, and its parameters — shaped like MCP tools/list.`

  static examples = ['<%= config.bin %> ai tools', '<%= config.bin %> ai tools --toolset ai:database-read --json']

  static flags = {
    toolset: Flags.string({description: 'Only the tools of this toolset'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiTools)
    const client = this.accountClient(flags)

    const res = await client.hub.account.getAiTools({toolset: flags.toolset})

    this.print(res)
    return res
  }
}
