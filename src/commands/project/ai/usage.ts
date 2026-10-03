import {Flags} from '@oclif/core'

import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectAiUsage extends ProjectCommand {
  static description = "Show this period's AI usage: totals, per assistant, per model and the top users"

  static examples = ['<%= config.bin %> project ai usage --top 5']

  static flags = {
    top: Flags.integer({description: 'How many top users to list'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectAiUsage)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.getProjectAiUsage({projectId, top: flags.top})

    this.print(res)
    return res
  }
}
