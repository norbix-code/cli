import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {formatTriggerRuns, TRIGGER_RUN_STATUSES, TRIGGER_TYPES} from '../../lib/triggers.js'

export default class TriggerRuns extends BaseCommand {
  static description = `List one trigger's runs, newest first

One row per firing per action, kept 30 days: when it started, the event, the
action, the result and its reason, who it ran as, and what it produced (a
campaign, a workflow run, a function). Use it to find out why a trigger did or
did not act; read one run with \`trigger run <run>\`. --json prints the page as
the Hub sent it.`

  static examples = [
    '<%= config.bin %> trigger runs Schema trg_8d1e0b',
    '<%= config.bin %> trigger runs Membership trg_8d1e0b --status failed',
    '<%= config.bin %> trigger runs Payments trg_8d1e0b --page-size 20 --after trr_1p4R3gTobGZpD6fX --json',
  ]

  static args = {
    triggerType: Args.string({required: true, options: TRIGGER_TYPES, description: 'Which kind of trigger'}),
    triggerId: Args.string({required: true, description: 'Trigger ID (trg_…)'}),
  }

  static flags = {
    status: Flags.string({options: TRIGGER_RUN_STATUSES, description: 'Only runs in this state'}),
    'page-size': Flags.integer({min: 1, description: 'Runs per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this run (trr_…)', exclusive: ['before']}),
    before: Flags.string({description: 'Cursor: fetch the page before this run (trr_…)', exclusive: ['after']}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(TriggerRuns)
    const client = this.client(flags)

    const res = await client.hub.triggers.getTriggerRuns({
      triggerType: args.triggerType as never,
      triggerId: args.triggerId,
      status: flags.status,
      pageSize: flags['page-size'],
      startingAfter: flags.after,
      endingBefore: flags.before,
    })

    this.print(formatTriggerRuns(res))
    return res
  }
}
