import {Args, Flags} from '@oclif/core'

import {ProjectCommand} from '../../../../lib/project.js'

export default class ProjectAiAssistantDelete extends ProjectCommand {
  static description = 'Delete an AI assistant'

  static examples = ['<%= config.bin %> project ai assistant delete 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'Assistant ID'}),
  }

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ProjectAiAssistantDelete)
    const {client, projectId} = this.projectClient(flags)

    if (!(await this.confirmOrStop(flags.yes, `Delete AI assistant ${args.id}?`))) return

    const res = await client.hub.account.deleteProjectAiAssistant({projectId, assistantId: args.id})

    this.print(`Assistant ${args.id} deleted.`)
    return res
  }
}
