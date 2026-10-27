import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {FORMATS, formatAs} from '../../../lib/workflows.js'

export default class CodeWorkflowsGet extends BaseCommand {
  static description = `Beta: one workflow — the latest published definition, or a pinned version

Prints the workflow (definition, version, hasDraft, isEnabled, the versions list, warnings). A workflow with only a draft answers with the draft and no version. --format yaml prints the definition alone as YAML: change it and send it back with \`code workflows save --file\` (it becomes the draft).`

  static examples = [
    '<%= config.bin %> code workflows get wf_3kQ9mZ2vXc8LpR4wT7yH1n',
    '<%= config.bin %> code workflows get wf_3kQ9mZ2vXc8LpR4wT7yH1n --format yaml > flow.yaml',
    '<%= config.bin %> code workflows get wf_3kQ9mZ2vXc8LpR4wT7yH1n --version 2 --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'Workflow ID (wf_…)'}),
  }

  static flags = {
    version: Flags.integer({description: 'A published version to read; default: the latest', min: 1}),
    format: Flags.string({description: 'json (the whole answer) or yaml (the definition alone)', options: FORMATS, default: 'json'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsGet)
    const client = this.client(flags)

    const res = await client.hub.code.getCodeWorkflow({
      id: args.id,
      ...(flags.version === undefined ? {} : {pinnedVersion: flags.version}),
    })

    this.print(formatAs(flags.format, res, res.workflow?.definition))
    return res
  }
}
