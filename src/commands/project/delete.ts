import {Flags} from '@oclif/core'

import {ProjectCommand} from '../../lib/project.js'

export default class ProjectDelete extends ProjectCommand {
  static description = `Delete the project

This removes the project with its data and cannot be undone. Without --yes the
command asks first, and refuses when there is no terminal to ask in.`

  static examples = ['<%= config.bin %> project delete --project 66b2f0a1... --yes']

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectDelete)
    const {client, projectId} = this.projectClient(flags)

    if (!(await this.confirmOrStop(flags.yes, `Delete project ${projectId} and all its data? This cannot be undone.`))) return

    const res = await client.hub.account.deleteProject({projectId})

    this.print(`Project ${projectId} deleted.`)
    return res
  }
}
