import {ProjectCommand} from '../../../../lib/project.js'
import {usageError} from '../../../../lib/cli-error.js'
import {boolFlag, boolOf} from '../../../../lib/membership.js'

export default class ProjectAiKnowledgeSet extends ProjectCommand {
  static description = `Turn the project's AI knowledge from uploaded files on or off

With --embed-files true, uploaded text files go into the project's AI
knowledge: assistants with the file source retrieve from them and cite them.
\`project ai settings\` shows the current value (embedFiles).`

  static examples = [
    '<%= config.bin %> project ai knowledge set --embed-files true',
    '<%= config.bin %> project ai knowledge set --embed-files false --dry-run',
  ]

  static flags = {
    ...ProjectCommand.dryRunFlags,
    'embed-files': boolFlag('Put uploaded text files into the AI knowledge'),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectAiKnowledgeSet)
    const embedFiles = boolOf(flags['embed-files'])
    if (embedFiles === undefined) throw usageError('Pass --embed-files true or --embed-files false.')
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectAiKnowledge({projectId, embedFiles})

    this.print(embedFiles ? 'Uploaded files now go into the AI knowledge.' : 'Uploaded files no longer go into the AI knowledge.')
    return res
  }
}
