import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {formatRuns} from '../../../lib/code.js'
import {
  formatRunsWithDetails,
  RUN_DETAILS_NEED_LOGS,
  type RunDetailLine,
  runCorrelationWithDetails,
  type RunWithDetails,
} from '../../../lib/marketplace.js'

const ONE_OF = ['function', 'trigger', 'task']

export default class CodeMarketplaceRuns extends BaseCommand {
  static description = `The last runs of a marketplace function, of a trigger or of a scheduler task

Newest first: when it ran, the event (invoke for a call by a user, an API key or the AI), the source (user, api-key, ai, database, membership, files, payments, scheduler), the function, the run-as user, the status (ok, failed, skipped), the duration in ms, the error, the vendor's request id and the correlation id. --function lists every run of one function from every source (up to 50 kept); --trigger and --task list the runs that trigger or task started (20 kept). A run through the Fake vendor also carries input — what the vendor received, secrets masked — printed as JSON under its row (a string with --json).

--details also reads each run's log lines — input, steps, the answer or the error — by its correlation id (GET /logs/audit). They exist only for a run made while the project's logs were on in that environment (hasDetails: true); any other row says "${RUN_DETAILS_NEED_LOGS}". With --json each row gains "details" (the lines, or null) and, when null, "detailsNote".`

  static examples = [
    '<%= config.bin %> code marketplace runs --function func_4hT8rW2nQ6xLmP0vZ3kJ1c',
    '<%= config.bin %> code marketplace runs --function func_4hT8rW2nQ6xLmP0vZ3kJ1c --limit 5 --details',
    '<%= config.bin %> code marketplace runs --trigger trg_1p4R3gTobGZpD6fXvHT4rd',
    '<%= config.bin %> code marketplace runs --task tsk_3kQ9mZ2vXc8LpR4wT7yH1n --limit 50 --json',
  ]

  static flags = {
    function: Flags.string({description: 'Marketplace function ID (func_…) whose runs to list, from every source', exactlyOne: ONE_OF}),
    trigger: Flags.string({description: 'Trigger ID (trg_…) whose runs to list', exactlyOne: ONE_OF}),
    task: Flags.string({description: 'Scheduler task ID (tsk_…) whose runs to list', exactlyOne: ONE_OF}),
    limit: Flags.integer({description: 'How many runs, newest first: 1-50 (default 20)', min: 1, max: 50}),
    details: Flags.boolean({description: "Also read each run's log lines (input, steps, answer) — only runs made while the project's logs were on have them", default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeMarketplaceRuns)
    const client = this.client(flags)

    const res = await client.hub.code.getMarketplaceFunctionRuns({
      functionId: flags.function,
      triggerId: flags.trigger,
      taskId: flags.task,
      limit: flags.limit,
    })

    if (!flags.details) {
      this.print(formatRuns(res))
      return res
    }

    const runs: RunWithDetails[] = []
    for (const run of (res?.runs ?? []) as unknown as Record<string, unknown>[]) {
      const correlationId = runCorrelationWithDetails(run)
      if (correlationId === undefined) {
        runs.push({...run, details: null, detailsNote: RUN_DETAILS_NEED_LOGS})
        continue
      }

      // One call per row, in order: at most 50 rows, and the lines stay next to their run.
      const lines = await client.hub.code.getMarketplaceFunctionRunDetails(correlationId)
      runs.push({...run, details: ((lines?.items ?? []) as unknown as RunDetailLine[])})
    }

    this.print(formatRunsWithDetails(runs))
    return {...res, runs}
  }
}
