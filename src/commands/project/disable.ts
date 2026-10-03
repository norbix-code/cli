import {Flags} from '@oclif/core'

import {ProjectCommand} from '../../lib/project.js'

export default class ProjectDisable extends ProjectCommand {
  static description = `Turn the project off

Its APIs stop answering until \`project enable\`. Nothing is deleted.`

  static examples = ['<%= config.bin %> project disable --yes']

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectDisable)
    const {client, projectId} = this.projectClient(flags)

    if (!(await this.confirmOrStop(flags.yes, `Turn off project ${projectId}? Its APIs stop answering.`))) return

    const res = await client.hub.account.disableProject({projectId})

    this.print(`Project ${projectId} disabled.`)
    return res
  }
}
