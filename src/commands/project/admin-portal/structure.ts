import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectAdminPortalStructure extends ProjectCommand {
  static description = `Show the admin portal layout: its name and the modules it shows

Only the project's admin portal service user gets an answer (sign in with that
user's API key); anyone else gets an empty result.`

  static examples = ['<%= config.bin %> project admin-portal structure --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectAdminPortalStructure)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.getAdminPortalStructure({projectId})

    this.print(res)
    return res
  }
}
