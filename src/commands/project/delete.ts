import {ProjectCommand} from '../../lib/project.js'

export default class ProjectDelete extends ProjectCommand {
  static description = `Delete the project

This removes the project with its data and cannot be undone. Without --yes the
command asks first, and refuses when there is no terminal to ask in.`

  static examples = [
    '<%= config.bin %> project delete --project 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> project delete --project 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static flags = {
    ...ProjectCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectDelete)
    const {client, projectId} = this.projectClient(flags)

    await this.confirmOrFail(`Delete project ${projectId} and all its data? This cannot be undone.`, flags)

    const res = await client.hub.account.deleteProject({projectId})

    this.print(`Project ${projectId} deleted.`)
    return res
  }
}
