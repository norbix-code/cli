import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {formatTriggerAttention, TRIGGER_TYPES} from '../../lib/triggers.js'

export default class TriggerAttention extends BaseCommand {
  static description = `List the triggers of one kind that need attention

A trigger needs attention when its last run stopped before it acted — a
template that no longer has every project language, an integration that is
gone, an identity without the permission. One line per trigger: the id, the
kind, since when, and the reason. Read the runs with \`trigger runs\`.`

  static examples = [
    '<%= config.bin %> trigger attention Schema',
    '<%= config.bin %> trigger attention Files --env TEST --json',
  ]

  static args = {
    triggerType: Args.string({required: true, options: TRIGGER_TYPES, description: 'Which kind of trigger'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(TriggerAttention)
    const client = this.client(flags)

    const res = await client.hub.triggers.getTriggersNeedingAttention({triggerType: args.triggerType as never})

    this.print(formatTriggerAttention(res))
    return res
  }
}
