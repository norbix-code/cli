import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {formatRun} from '../../../lib/workflows.js'

export default class CodeWorkflowsCancel extends BaseCommand {
  static description = `Beta: stop a running or waiting run

Queued steps are not started, a running step finishes and keeps its output, waiting steps are cancelled; child runs are not touched. A finished run cannot be stopped. Prints the run.`

  static examples = [
    '<%= config.bin %> code workflows cancel wfr_5nB2xQ7wLk9RmT3vYc1HdP --yes',
    '<%= config.bin %> code workflows cancel wfr_5nB2xQ7wLk9RmT3vYc1HdP --reason "order withdrawn" --dry-run',
  ]

  static args = {
    runId: Args.string({required: true, description: 'Run ID (wfr_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
    reason: Flags.string({description: 'Why the run was stopped (kept on the run)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsCancel)
    const client = this.client(flags)
    await this.confirmOrFail(`Stop run ${args.runId}?`, flags)

    const res = await client.hub.code.cancelCodeWorkflowRun({runId: args.runId, ...(flags.reason ? {reason: flags.reason} : {})})

    this.print(formatRun(res.run))
    return res
  }
}
