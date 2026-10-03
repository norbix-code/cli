import {assistantBody, assistantFlags} from '../../../../lib/assistant.js'
import {ProjectCommand} from '../../../../lib/project.js'

export default class ProjectAiAssistantCreate extends ProjectCommand {
  static description = `Add an AI assistant to the project

An assistant is a named chat persona: its instructions, the tools it may use,
the LLM and model it runs on. List them with \`project ai settings\`.`

  static examples = [
    '<%= config.bin %> project ai assistant create --name Support --system-prompt-file support.md --toolset ai:database-read',
    '<%= config.bin %> project ai assistant create --name Support --system-prompt-file support.md --toolset ai:database-read --dry-run',
  ]

  static flags = {
    ...ProjectCommand.dryRunFlags,
    ...assistantFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectAiAssistantCreate)
    if (!flags.name) this.error('Pass --name.')
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.createProjectAiAssistant({projectId, ...assistantBody(flags)})

    this.print(res)
    return res
  }
}
