import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectAiPlans extends ProjectCommand {
  static description = `Show the end-user AI plans of the project

A plan is a monthly quota (credits, tokens or none) with the assistants,
models and features its users may use. The answer also has the role → plan
rows (the first row whose role a user has wins) and the default plan.
Change them with \`project ai plans set\` and \`project ai plans assign\`.`

  static examples = ['<%= config.bin %> project ai plans', '<%= config.bin %> project ai plans --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectAiPlans)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.getProjectAiPlans({projectId})

    this.print(res)
    return res
  }
}
