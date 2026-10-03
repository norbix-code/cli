import {Args} from '@oclif/core'

import {ProjectCommand} from '../../../../lib/project.js'

export default class ProjectAiAssistantDelete extends ProjectCommand {
  static description = 'Delete an AI assistant'

  static examples = [
    '<%= config.bin %> project ai assistant delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> project ai assistant delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Assistant ID'}),
  }

  static flags = {
    ...ProjectCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ProjectAiAssistantDelete)
    const {client, projectId} = this.projectClient(flags)

    await this.confirmOrFail(`Delete AI assistant ${args.id}?`, flags)

    const res = await client.hub.account.deleteProjectAiAssistant({projectId, assistantId: args.id})

    this.print(`Assistant ${args.id} deleted.`)
    return res
  }
}
