import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectBrandExpose extends ProjectCommand {
  static description = `Show the project brand to the public (on by default)

The public project config (\`project public-config\`, read by the Admin
Portal before anyone signs in) then carries the name, colours, logo and icon,
and \`project brand show\` serves the logo and icon.`

  static examples = [
    '<%= config.bin %> project brand expose',
    '<%= config.bin %> project brand expose --dry-run',
  ]

  static flags = {
    ...ProjectCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectBrandExpose)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectExposeBrand({projectId, exposed: true})

    this.print('The brand is public.')
    return res
  }
}
