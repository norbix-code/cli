import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class CodeWorkflowsVersions extends BaseCommand {
  static description = `Beta: the published versions of a workflow

One row per version: the number, when and by whom it was published, its name and step count. Compare two with \`code workflows diff\`; read one with \`code workflows get <id> --version N\`.`

  static examples = ['<%= config.bin %> code workflows versions wf_3kQ9mZ2vXc8LpR4wT7yH1n']

  static args = {
    id: Args.string({required: true, description: 'Workflow ID (wf_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsVersions)
    const client = this.client(flags)

    const res = await client.hub.code.getCodeWorkflowVersions({id: args.id})

    this.print(res)
    return res
  }
}
