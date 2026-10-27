import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {formatRun} from '../../../lib/workflows.js'

export default class CodeWorkflowsRetry extends BaseCommand {
  static description = `Beta: retry the failed step of a failed run

A new attempt of the step runs from its stored input; the run goes back to running and continues along the step's edges. The run must be failed, and the step the one its error names (the default). The run's budget still applies. Prints the run.`

  static examples = [
    '<%= config.bin %> code workflows retry wfr_5nB2xQ7wLk9RmT3vYc1HdP --yes',
    '<%= config.bin %> code workflows retry wfr_5nB2xQ7wLk9RmT3vYc1HdP --step charge-card --dry-run',
  ]

  static args = {
    runId: Args.string({required: true, description: 'Run ID (wfr_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
    step: Flags.string({description: "The failed step (its stepId); default: the step named in the run's error"}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsRetry)
    const client = this.client(flags)
    await this.confirmOrFail(`Retry ${flags.step ? `step ${flags.step}` : 'the failed step'} of run ${args.runId}?`, flags)

    const res = await client.hub.code.retryCodeWorkflowRunStep({runId: args.runId, ...(flags.step ? {stepId: flags.step} : {})})

    this.print(formatRun(res.run))
    return res
  }
}
