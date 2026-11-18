import {ProjectCommand} from '../../../../lib/project.js'

export default class ProjectAiPlansUsers extends ProjectCommand {
  static description = `List the users that have their own end-user AI plan

Users not listed get the plan of their first mapped role, else the default
plan (\`project ai plans\`).`

  static examples = ['<%= config.bin %> project ai plans users', '<%= config.bin %> project ai plans users --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectAiPlansUsers)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.getProjectAiUserPlans({projectId})

    this.print(res)
    return res
  }
}
