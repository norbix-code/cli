import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {formatRun} from '../../../lib/workflows.js'

export default class CodeWorkflowsRun extends BaseCommand {
  static description = `Beta: one workflow run with its steps

The run's status, version, source and timing, what it waits on, its error, then one row per step execution: stepId, kind, status (with the decision of an approval), attempt, pass (loops) and duration, and the run's output. --json prints the whole run with every step's input, output and error.`

  static examples = [
    '<%= config.bin %> code workflows run wfr_5nB2xQ7wLk9RmT3vYc1HdP',
    '<%= config.bin %> code workflows run wfr_5nB2xQ7wLk9RmT3vYc1HdP --json',
  ]

  static args = {
    runId: Args.string({required: true, description: 'Run ID (wfr_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsRun)
    const client = this.client(flags)

    const res = await client.hub.code.getCodeWorkflowRun({runId: args.runId})

    this.print(formatRun(res.run))
    return res
  }
}
