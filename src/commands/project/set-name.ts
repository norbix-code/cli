import {Args} from '@oclif/core'

import {ProjectCommand} from '../../lib/project.js'

export default class ProjectSetName extends ProjectCommand {
  static description = 'Rename the project'

  static examples = [
    '<%= config.bin %> project set-name "Shop backend"',
    '<%= config.bin %> project set-name "Shop backend" --dry-run',
  ]

  static args = {
    name: Args.string({required: true, description: 'New project name'}),
  }

  static flags = {
    ...ProjectCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ProjectSetName)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectName({projectId, name: args.name})

    this.print(`Project renamed to "${args.name}".`)
    return res
  }
}
