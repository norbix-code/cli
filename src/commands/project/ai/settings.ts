import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectAiSettings extends ProjectCommand {
  static description = `Show the project's AI chat settings and its assistants

Whether AI chat is on, the default LLM integration and model, and every
assistant (name, prompt, tools, model).`

  static examples = ['<%= config.bin %> project ai settings']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectAiSettings)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.getProjectAiSettings({projectId})

    this.print(res)
    return res
  }
}
