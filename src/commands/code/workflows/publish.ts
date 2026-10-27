import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {formatWorkflow} from '../../../lib/workflows.js'

export default class CodeWorkflowsPublish extends BaseCommand {
  static description = `Beta: publish the draft of a workflow

The draft becomes published version N+1 and is cleared; every save check runs again. New runs use it from now on; runs in flight finish on their own version. Check the change first with \`code workflows draft <id>\` or \`code workflows diff\`.`

  static examples = [
    '<%= config.bin %> code workflows publish wf_3kQ9mZ2vXc8LpR4wT7yH1n --yes',
    '<%= config.bin %> code workflows publish wf_3kQ9mZ2vXc8LpR4wT7yH1n --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Workflow ID (wf_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsPublish)
    const client = this.client(flags)
    await this.confirmOrFail(`Publish the draft of workflow ${args.id}?`, flags)

    const res = await client.hub.code.publishCodeWorkflow({id: args.id})

    this.print(formatWorkflow('published', res))
    return res
  }
}
