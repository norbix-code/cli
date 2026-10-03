import {ProjectCommand} from '../../lib/project.js'

export default class ProjectDisable extends ProjectCommand {
  static description = `Turn the project off

Its APIs stop answering until \`project enable\`. Nothing is deleted.`

  static examples = [
    '<%= config.bin %> project disable --yes',
    '<%= config.bin %> project disable --dry-run',
  ]

  static flags = {
    ...ProjectCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectDisable)
    const {client, projectId} = this.projectClient(flags)

    await this.confirmOrFail(`Turn off project ${projectId}? Its APIs stop answering.`, flags)

    const res = await client.hub.account.disableProject({projectId})

    this.print(`Project ${projectId} disabled.`)
    return res
  }
}
