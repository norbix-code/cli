import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class CodeWorkflowsLogs extends BaseCommand {
  static description = `Beta: the log lines of a workflow run, newest first

Every step's lines, or one step's with --step. Needs the Logs module enabled in this environment and logs:read.`

  static examples = [
    '<%= config.bin %> code workflows logs wfr_5nB2xQ7wLk9RmT3vYc1HdP',
    '<%= config.bin %> code workflows logs wfr_5nB2xQ7wLk9RmT3vYc1HdP --step notify --level Error --json',
  ]

  static args = {
    runId: Args.string({required: true, description: 'Run ID (wfr_…)'}),
  }

  static flags = {
    step: Flags.string({description: "Only this step's lines (its stepId)"}),
    level: Flags.string({description: 'Only this severity', options: ['Information', 'Warning', 'Error']}),
    limit: Flags.integer({description: 'Page size (lines per page)', min: 1}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
    before: Flags.string({description: 'Cursor: fetch the page before this item'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsLogs)
    const client = this.client(flags)

    const res = await client.hub.code.getCodeWorkflowRunLogs({
      runId: args.runId,
      ...(flags.step ? {stepId: flags.step} : {}),
      ...(flags.level ? {level: flags.level} : {}),
      ...(flags.limit ? {pageSize: flags.limit} : {}),
      ...(flags.after ? {startingAfter: flags.after} : {}),
      ...(flags.before ? {endingBefore: flags.before} : {}),
    })

    this.print(res)
    return res
  }
}
