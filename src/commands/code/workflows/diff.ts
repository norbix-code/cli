import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class CodeWorkflowsDiff extends BaseCommand {
  static description = `Beta: what changed between two published versions of a workflow

The added and removed step ids, the changed steps with the paths that changed, and the changed top-level fields.`

  static examples = ['<%= config.bin %> code workflows diff wf_3kQ9mZ2vXc8LpR4wT7yH1n --from 1 --to 2']

  static args = {
    id: Args.string({required: true, description: 'Workflow ID (wf_…)'}),
  }

  static flags = {
    from: Flags.integer({required: true, description: 'The earlier version', min: 1}),
    to: Flags.integer({required: true, description: 'The later version', min: 1}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsDiff)
    const client = this.client(flags)

    const res = await client.hub.code.getCodeWorkflowVersionDiff({id: args.id, fromVersion: flags.from, toVersion: flags.to})

    this.print(res)
    return res
  }
}
