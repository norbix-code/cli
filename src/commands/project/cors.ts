import {ProjectCommand, originsOf} from '../../lib/project.js'

export default class ProjectCors extends ProjectCommand {
  static description = `List the browser origins allowed to call the project's APIs (CORS)

One of them is usually the project's own admin portal; the server will not
drop it unless you ask for that on purpose (\`--remove-admin-portal-origin\`).`

  static examples = ['<%= config.bin %> project cors']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectCors)
    const {client, projectId} = this.projectClient(flags)

    const origins = originsOf(await client.hub.account.getProject({projectId}))

    if (!this.jsonEnabled()) this.log(origins.length > 0 ? origins.join('\n') : 'No allowed origins.')
    return {origins}
  }
}
