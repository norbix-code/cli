import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {formatWorkflow} from '../../../lib/workflows.js'

export default class CodeWorkflowsDisable extends BaseCommand {
  static description = `Beta: turn a workflow off

No new run starts from any source (trigger, scheduler task, invoke). Runs in flight continue and a waiting run may still be resumed. Turn it back on with \`code workflows enable <id>\`.`

  static examples = [
    '<%= config.bin %> code workflows disable wf_3kQ9mZ2vXc8LpR4wT7yH1n --yes',
    '<%= config.bin %> code workflows disable wf_3kQ9mZ2vXc8LpR4wT7yH1n --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Workflow ID (wf_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Turn off workflow ${args.id}?`, flags)

    const res = await client.hub.code.disableCodeWorkflow({id: args.id})

    this.print(formatWorkflow('disabled', res))
    return res
  }
}
