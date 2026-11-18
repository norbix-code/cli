import {Args, Flags} from '@oclif/core'

import {AiChatCommand, CHAT_TURN_TIMEOUT_MS} from '../../lib/ai-chat.js'

export default class AiChat extends AiChatCommand {
  static description = `Send one message to the developer AI chat and print the reply

The chat of the Cloud dashboard. Without --session a new chat starts (with
--surface, default "assistant"); with it the chat goes on. When a project is
set, its id and environment ride along (the env rule applies), so the chat
works on that project; --account-level sends neither. The turn runs the model and
the tools it calls before the reply comes back (up to 5 minutes).

A plan the assistant proposes, a question it asks or a step it runs is an
entry of the session: read them with \`ai chat entries\`, answer with
\`ai chat plan\` / \`ai chat answer\`.`

  static examples = [
    '<%= config.bin %> ai chat "Add a phone field to customers" --prod',
    '<%= config.bin %> ai chat "And make it required" --session aics_123 --prod',
    '<%= config.bin %> ai chat "Which projects do I have?" --account-level',
    '<%= config.bin %> ai chat "Hi" --llm int_llm1 --model gpt-4o-mini --json',
    '<%= config.bin %> ai chat "Add a phone field to customers" --prod --dry-run',
  ]

  static args = {
    message: Args.string({required: true, description: 'What to ask (quote it)'}),
  }

  static flags = {
    session: Flags.string({description: 'Continue this chat (aics_…); empty starts a new one'}),
    surface: Flags.string({description: 'Surface (chat profile) of a new chat', default: 'assistant'}),
    topic: Flags.string({description: 'Topic hint of a new chat (e.g. "database schema creation")'}),
    llm: Flags.string({description: 'LLM integration id to answer with (default: the host default)'}),
    model: Flags.string({description: 'Model of that integration (one the availability lists)'}),
    ...AiChatCommand.accountFlag,
    ...AiChatCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiChat)
    const {client, scope} = this.scopedClient(flags)

    const res = await client.hub.account.chatTurn(
      {
        message: args.message,
        sessionId: flags.session,
        profile: flags.session ? undefined : flags.surface,
        topic: flags.session ? undefined : flags.topic,
        llmIntegrationId: flags.llm,
        model: flags.model,
        ...scope,
      },
      {timeoutMs: CHAT_TURN_TIMEOUT_MS},
    )

    if (!this.jsonEnabled()) {
      this.log(res.reply ?? '')
      if (res.toolTrace?.length) this.log(`\nTools: ${res.toolTrace.join(', ')}`)
      this.log(`Session: ${res.sessionId}`)
    }
    return res
  }
}
