import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class CodeWorkflowsDelete extends BaseCommand {
  static description = `Beta: delete a workflow

Every version and the draft go. Runs in flight finish on their snapshot; runs waiting on a delay, an event or an approval are cancelled (reason workflow-deleted). Triggers and scheduler tasks that start it fail from then on.`

  static examples = [
    '<%= config.bin %> code workflows delete wf_3kQ9mZ2vXc8LpR4wT7yH1n --yes',
    '<%= config.bin %> code workflows delete wf_3kQ9mZ2vXc8LpR4wT7yH1n --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Workflow ID (wf_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsDelete)
    const client = this.client(flags)
    await this.confirmOrFail(`Delete workflow ${args.id} (waiting runs are cancelled)?`, flags)

    const res = await client.hub.code.deleteCodeWorkflow({id: args.id})

    this.print(`Workflow ${args.id} deleted.`)
    return res
  }
}
