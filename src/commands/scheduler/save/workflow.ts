import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {parseKeyValues} from '../../../lib/marketplace.js'
import {CRON_FIELDS, parseCron, taskFlags, taskRequest} from '../../../lib/scheduler.js'
import {EXECUTION_IDENTITY_HELP} from '../../../lib/triggers.js'

export default class SchedulerSaveWorkflow extends BaseCommand {
  static description = `Beta: create or update a "Workflow call" task: start a workflow on a cron

Each time --cron fires (5 fields: ${CRON_FIELDS}, UTC) the task starts a run of --workflow (wf_…; \`norbix code workflows list\`), with source "scheduler". --payload key=value fills the run's @Model.Request.* values (strings; repeat for several). The run acts as the workflow's own execution identity; the task's initiator only has to be allowed to start it (code:execute on the workflow, else CM-ERRORS-SCHEDULER-012). The workflow must exist in the task's environment (CM-ERRORS-WORKFLOWS-002).

Without --id a new task is created; with --id that task is replaced (send every field again). --execution-identity: ${EXECUTION_IDENTITY_HELP}. Workflows are in beta; bugs may occur. Prints the task ID.`

  static examples = [
    '<%= config.bin %> scheduler save workflow --name "Nightly onboarding sweep" --cron "0 3 * * *" --workflow wf_3kQ9mZ2vXc8LpR4wT7yH1n --yes',
    '<%= config.bin %> scheduler save workflow --name "Weekly report" --cron "0 8 * * 1" --workflow wf_3kQ9mZ2vXc8LpR4wT7yH1n --payload period=week --payload channel=email --dry-run',
  ]

  static flags = {
    ...BaseCommand.mutatingFlags,
    ...taskFlags,
    workflow: Flags.string({required: true, description: 'Workflow ID (wf_…) to start'}),
    payload: Flags.string({description: "A value for the run's @Model.Request.*, key=value (repeat for several)", multiple: true}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SchedulerSaveWorkflow)
    const cron = parseCron(flags.cron, (message) => this.error(message))
    const payload = parseKeyValues(flags.payload, 'payload')

    const task: Record<string, unknown> = {
      type: 'WorkflowCall',
      workflowRef: flags.workflow,
      ...(payload ? {payload} : {}),
    }

    const client = this.client(flags)
    const what = flags.id ? `Update scheduler task ${flags.id}` : `Create scheduler task "${flags.name}"`
    await this.confirmOrFail(`${what}: start ${flags.workflow} (cron "${cron}" UTC)?`, flags)

    const res = await client.hub.scheduler.saveSchedulerTask(
      taskRequest(flags, cron, task) as unknown as Parameters<typeof client.hub.scheduler.saveSchedulerTask>[0],
    )

    const id = (res as {id?: string} | undefined)?.id ?? flags.id
    this.print(id ? `Task ${id} saved.` : 'Task saved.')
    return res
  }
}
