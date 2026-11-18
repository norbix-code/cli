import {Flags} from '@oclif/core'

import {ProjectCommand} from '../../lib/project.js'

export default class ProjectHealth extends ProjectCommand {
  static description = `Show what is wrong with the project and what to fix next

The project health of the request environment (--env): a list of problems
(templates missing a project language, a module that is off while something
still needs it, integrations never tested or failing, triggers whose target
is gone, failing scheduler tasks), each with the Cloud page that fixes it,
and the user / e-mail / API call numbers of the period.

The Hub computes it every 6 hours and keeps the result; --refresh computes
it now (after you fixed something).`

  static examples = [
    '<%= config.bin %> project health',
    '<%= config.bin %> project health --refresh --period 7',
    '<%= config.bin %> project health --env TEST --json',
  ]

  static flags = {
    refresh: Flags.boolean({description: 'Compute it now instead of reading the last result', default: false}),
    period: Flags.string({description: 'Days the numbers cover', options: ['7', '30', '90']}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectHealth)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.getProjectHealth({
      projectId,
      ...(flags.refresh ? {refresh: true} : {}),
      ...(flags.period ? {periodDays: Number(flags.period)} : {}),
    })

    this.print(res)
    return res
  }
}
