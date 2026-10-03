import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectLegalExpose extends ProjectCommand {
  static description = "Show the project's legal documents to the public (admin portal and the public legal route)"

  static examples = [
    '<%= config.bin %> project legal expose',
    '<%= config.bin %> project legal expose --dry-run',
  ]

  static flags = {
    ...ProjectCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectLegalExpose)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectExposeLegal({projectId, exposed: true})

    this.print('Legal documents are public.')
    return res
  }
}
