import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {formatRuns} from '../../lib/code.js'

export default class CodeRuns extends BaseCommand {
  static description = `The last cloud-function runs of a trigger or a scheduler task

Newest first: when it fired, the event, whether it succeeded, the status code, the duration in ms, the error and the provider's request id. A run through the Sandbox provider (API value Fake) also carries input — the envelope the function received, context.runAs.accessToken masked, cut at 64 KB — printed as JSON under its row (a string with --json). The same list as the Last runs panel of the trigger's or task's edit screen.`

  static examples = [
    '<%= config.bin %> code runs --trigger trg_1p4R3gTobGZpD6fXvHT4rd',
    '<%= config.bin %> code runs --task tsk_3kQ9mZ2vXc8LpR4wT7yH1n --limit 50 --json',
  ]

  static flags = {
    trigger: Flags.string({description: 'Trigger ID (trg_…) whose runs to list', exactlyOne: ['trigger', 'task']}),
    task: Flags.string({description: 'Scheduler task ID (tsk_…) whose runs to list', exactlyOne: ['trigger', 'task']}),
    limit: Flags.integer({description: 'How many runs, newest first: 1-50 (default 20)', min: 1, max: 50}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeRuns)
    const client = this.client(flags)

    const res = await client.hub.code.getCodeFunctionRuns({
      triggerId: flags.trigger,
      taskId: flags.task,
      limit: flags.limit,
    })

    this.print(formatRuns(res))
    return res
  }
}
