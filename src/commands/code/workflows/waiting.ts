import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {formatWaitingRuns, RUN_STATUSES, WAITING_KINDS} from '../../../lib/workflows.js'

export default class CodeWorkflowsWaiting extends BaseCommand {
  static description = `Beta: the inbox — runs waiting on a person, an event, a delay or a child run

Across every workflow you may read: one row per wait with what it waits on (step, kind, key, assignees, until, child run). A group approval (a wait that needs several people) gets a line under the table: how many approvals it has of how many it needs, and who has not answered. --mine: only approvals assigned to you that you have not answered yet. --app-user calls the Api host's twin of this route, for an app user's login (a project user, not a team member): it lists only that user's own approvals.`

  static examples = [
    '<%= config.bin %> code workflows waiting --mine',
    '<%= config.bin %> code workflows waiting --kind approval --workflow wf_3kQ9mZ2vXc8LpR4wT7yH1n --json',
    '<%= config.bin %> code workflows waiting --workflow wf_3kQ9mZ2vXc8LpR4wT7yH1n --key order-6ac54a59',
    '<%= config.bin %> code workflows waiting --mine --app-user',
  ]

  static flags = {
    mine: Flags.boolean({description: 'Only approvals assigned to you (assignee=me)', exclusive: ['assignee']}),
    assignee: Flags.string({description: 'Only approvals assigned to this user (usr_…)', exclusive: ['mine']}),
    kind: Flags.string({description: 'Only waits of this kind', options: WAITING_KINDS}),
    workflow: Flags.string({description: 'Only runs of this workflow (wf_…)'}),
    key: Flags.string({description: "Only the run whose wait has this key (exact match)"}),
    status: Flags.string({description: 'Run state (server default: waiting)', options: RUN_STATUSES}),
    'app-user': Flags.boolean({description: "Use the Api host's route (an app user's login) instead of the Hub's", default: false}),
    limit: Flags.integer({description: 'Page size (rows per page)', min: 1}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
    before: Flags.string({description: 'Cursor: fetch the page before this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeWorkflowsWaiting)
    const client = this.client(flags)

    const request = {
      ...(flags.mine ? {assignee: 'me'} : {}),
      ...(flags.assignee ? {assignee: flags.assignee} : {}),
      ...(flags.kind ? {waitingKind: flags.kind} : {}),
      ...(flags.workflow ? {workflowId: flags.workflow} : {}),
      ...(flags.key ? {key: flags.key} : {}),
      ...(flags.status ? {status: flags.status} : {}),
      ...(flags.limit ? {pageSize: flags.limit} : {}),
      ...(flags.after ? {startingAfter: flags.after} : {}),
      ...(flags.before ? {endingBefore: flags.before} : {}),
    }
    const res = flags['app-user']
      ? await client.api.code.getCodeWorkflowWaitingRuns(request)
      : await client.hub.code.getCodeWorkflowWaitingRuns(request)

    this.print(formatWaitingRuns(res))
    return res
  }
}
