import {Args, Flags} from '@oclif/core'

import {AiChatCommand} from '../../../lib/ai-chat.js'

export default class AiChatPlan extends AiChatCommand {
  static description = `Approve or reject a plan the assistant proposed in a chat

approve runs the plan's steps; reject with --comment starts a new plan that
follows the comment.`

  static examples = [
    '<%= config.bin %> ai chat plan aics_123 ent_456 approve',
    '<%= config.bin %> ai chat plan aics_123 ent_456 reject --comment "Keep the old field"',
    '<%= config.bin %> ai chat plan aics_123 ent_456 approve --dry-run',
  ]

  static args = {
    session: Args.string({required: true, description: 'Chat id (aics_…)'}),
    entry: Args.string({required: true, description: 'The plan entry (ent_…)'}),
    decision: Args.string({required: true, options: ['approve', 'reject'], description: 'approve or reject'}),
  }

  static flags = {
    comment: Flags.string({description: 'On reject: what to do instead; on approve: a note'}),
    ...AiChatCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiChatPlan)
    const client = this.accountClient(flags)

    const res = await client.hub.account.decideChatPlan({
      sessionId: args.session,
      entryId: args.entry,
      decision: args.decision,
      comment: flags.comment,
    })

    this.print(res)
    return res
  }
}
