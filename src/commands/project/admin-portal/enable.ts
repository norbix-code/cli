import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectAdminPortalEnable extends ProjectCommand {
  static description = `Turn on the project's admin portal

The admin portal is the end-user site Norbix generates for the project. See its
address with \`project\` (effectiveAdminUrl).`

  static examples = [
    '<%= config.bin %> project admin-portal enable',
    '<%= config.bin %> project admin-portal enable --dry-run',
  ]

  static flags = {
    ...ProjectCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectAdminPortalEnable)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.setAdminPortalEnabled({projectId, enabled: true})

    this.print('Admin portal enabled.')
    return res
  }
}
