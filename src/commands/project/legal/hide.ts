import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectLegalHide extends ProjectCommand {
  static description = "Stop showing the project's legal documents to the public"

  static examples = [
    '<%= config.bin %> project legal hide',
    '<%= config.bin %> project legal hide --dry-run',
  ]

  static flags = {
    ...ProjectCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectLegalHide)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectExposeLegal({projectId, exposed: false})

    this.print('Legal documents are hidden.')
    return res
  }
}
