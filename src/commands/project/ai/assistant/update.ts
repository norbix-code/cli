import {Args} from '@oclif/core'

import {type Assistant, assistantBody, assistantFlags} from '../../../../lib/assistant.js'
import {ProjectCommand} from '../../../../lib/project.js'

export default class ProjectAiAssistantUpdate extends ProjectCommand {
  static description = `Change an AI assistant

The server replaces the whole assistant, so this reads it first and changes
only what you pass. --no-memory / --no-default turn those off.`

  static examples = [
    '<%= config.bin %> project ai assistant update 66b2f0a1c3d4e5f6a7b8c9d0 --model gpt-4o --no-memory',
    '<%= config.bin %> project ai assistant update 66b2f0a1c3d4e5f6a7b8c9d0 --model gpt-4o --no-memory --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Assistant ID'}),
  }

  static flags = {
    ...ProjectCommand.dryRunFlags,
    ...assistantFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ProjectAiAssistantUpdate)
    const {client, reader, projectId} = this.projectClient(flags)

    const settings = (await reader.hub.account.getProjectAiSettings({projectId})) as {result?: {assistants?: Assistant[]}}
    const current = settings.result?.assistants?.find((a) => a.id === args.id)
    if (!current) this.error(`No assistant ${args.id} in this project. See them with \`norbix project ai settings\`.`)

    const res = await client.hub.account.updateProjectAiAssistant({
      projectId,
      assistantId: args.id,
      ...assistantBody(flags, current),
    })

    this.print(`Assistant ${args.id} saved.`)
    return res
  }
}
