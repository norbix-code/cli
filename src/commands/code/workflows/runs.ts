import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {RUN_STATUSES} from '../../../lib/workflows.js'

export default class CodeWorkflowsRuns extends BaseCommand {
  static description = `Beta: the runs of a workflow, newest first

One row per run: runId, version (or draft), status, source (trigger, scheduler, invoke, workflow), started / finished, duration, the steps running now, what it waits on, the error. Read one with \`code workflows run <runId>\`.`

  static examples = [
    '<%= config.bin %> code workflows runs wf_3kQ9mZ2vXc8LpR4wT7yH1n',
    '<%= config.bin %> code workflows runs wf_3kQ9mZ2vXc8LpR4wT7yH1n --status failed --from 2026-10-01T00:00:00Z --to 2026-10-27T00:00:00Z --limit 50 --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'Workflow ID (wf_…)'}),
  }

  static flags = {
    status: Flags.string({description: 'Only runs in this state', options: RUN_STATUSES}),
    from: Flags.string({description: 'Only runs started at or after this time (ISO 8601)'}),
    to: Flags.string({description: 'Only runs started before this time (ISO 8601)'}),
    limit: Flags.integer({description: 'Page size (rows per page)', min: 1}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
    before: Flags.string({description: 'Cursor: fetch the page before this item'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsRuns)
    const client = this.client(flags)

    const res = await client.hub.code.getCodeWorkflowRuns({
      id: args.id,
      ...(flags.status ? {status: flags.status} : {}),
      ...(flags.from ? {from: flags.from} : {}),
      ...(flags.to ? {to: flags.to} : {}),
      ...(flags.limit ? {pageSize: flags.limit} : {}),
      ...(flags.after ? {startingAfter: flags.after} : {}),
      ...(flags.before ? {endingBefore: flags.before} : {}),
    })

    this.print(res)
    return res
  }
}
