import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectBrandHide extends ProjectCommand {
  static description = `Hide the project brand from the public

The public project config no longer carries the name, colours, logo and
icon, and the public logo / icon addresses answer 404 (within five minutes:
browsers may keep the picture that long).`

  static examples = [
    '<%= config.bin %> project brand hide',
    '<%= config.bin %> project brand hide --dry-run',
  ]

  static flags = {
    ...ProjectCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectBrandHide)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectExposeBrand({projectId, exposed: false})

    this.print('The brand is hidden from the public.')
    return res
  }
}
