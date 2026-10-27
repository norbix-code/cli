import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {FORMATS, formatAs} from '../../../lib/workflows.js'

export default class CodeWorkflowsDraft extends BaseCommand {
  static description = `Beta: show the unpublished draft of a workflow, or discard it

Prints the workflow with the draft as its definition; --format yaml prints the draft definition alone as YAML. --discard deletes the draft (asks first); the published version stays.`

  static examples = [
    '<%= config.bin %> code workflows draft wf_3kQ9mZ2vXc8LpR4wT7yH1n',
    '<%= config.bin %> code workflows draft wf_3kQ9mZ2vXc8LpR4wT7yH1n --format yaml',
    '<%= config.bin %> code workflows draft wf_3kQ9mZ2vXc8LpR4wT7yH1n --discard --yes',
    '<%= config.bin %> code workflows draft wf_3kQ9mZ2vXc8LpR4wT7yH1n --discard --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Workflow ID (wf_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
    discard: Flags.boolean({description: 'Delete the draft instead of showing it', default: false}),
    format: Flags.string({description: 'json (the whole answer) or yaml (the draft definition alone)', options: FORMATS, default: 'json'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsDraft)
    const client = this.client(flags)

    if (flags.discard) {
      await this.confirmOrFail(`Discard the draft of workflow ${args.id}?`, flags)
      const res = await client.hub.code.discardCodeWorkflowDraft({id: args.id})
      this.print(`Draft of workflow ${args.id} discarded.`)
      return res
    }

    const res = await client.hub.code.getCodeWorkflowDraft({id: args.id})

    this.print(formatAs(flags.format, res, res.workflow?.definition))
    return res
  }
}
