import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {formatTaskRuns, type TaskRun} from '../../lib/scheduler.js'

export default class SchedulerRuns extends BaseCommand {
  static description = `Show a task's run history

The latest runs of the task, newest first: when it fired, the outcome (Fired, Failed or Skipped), a reason code on a failed or skipped run (run-failed, module-disabled, initiator-not-found, …), who it ran as and the detail of a failure. --take picks how many (1–50, default 10). --json prints the gateway's answer.`

  static examples = [
    '<%= config.bin %> scheduler runs tsk_66b2f0a1',
    '<%= config.bin %> scheduler runs tsk_66b2f0a1 --take 50 --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'Task ID (tsk_…)'}),
  }

  static flags = {
    take: Flags.integer({description: 'How many runs, newest first (1–50, default 10)', min: 1, max: 50}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SchedulerRuns)
    const client = this.client(flags)

    const res = await client.hub.scheduler.getSchedulerTaskRuns({id: args.id, ...(flags.take ? {take: flags.take} : {})})

    this.print(formatTaskRuns((res as {runs?: TaskRun[]}).runs))
    return res
  }
}
