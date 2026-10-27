import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {formatWorkflow} from '../../../lib/workflows.js'

export default class CodeWorkflowsEnable extends BaseCommand {
  static description = `Beta: turn a workflow on

Triggers, scheduler tasks and invoke may start new runs again. Also resets the runaway counters of a workflow that was turned off as a runaway.`

  static examples = [
    '<%= config.bin %> code workflows enable wf_3kQ9mZ2vXc8LpR4wT7yH1n',
    '<%= config.bin %> code workflows enable wf_3kQ9mZ2vXc8LpR4wT7yH1n --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Workflow ID (wf_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsEnable)
    const client = this.client(flags)

    const res = await client.hub.code.enableCodeWorkflow({id: args.id})

    this.print(formatWorkflow('enabled', res))
    return res
  }
}
