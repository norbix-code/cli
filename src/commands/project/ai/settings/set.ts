import {Flags} from '@oclif/core'

import {ProjectCommand} from '../../../../lib/project.js'

interface AiSettings {
  enabled?: boolean
  defaultLlmIntegrationId?: string
  defaultModel?: string
}

export default class ProjectAiSettingsSet extends ProjectCommand {
  static description = `Turn AI chat on or off and pick its default LLM and model

The server replaces all three settings at once, so this reads the current ones
first and changes only what you pass.`

  static examples = [
    '<%= config.bin %> project ai settings set --enable --llm 66b2f0a1c3d4e5f6a7b8c9d0 --model gpt-4o-mini',
    '<%= config.bin %> project ai settings set --disable',
    '<%= config.bin %> project ai settings set --enable --llm 66b2f0a1c3d4e5f6a7b8c9d0 --model gpt-4o-mini --dry-run',
  ]

  static flags = {
    ...ProjectCommand.dryRunFlags,
    enable: Flags.boolean({description: 'Turn AI chat on', exclusive: ['disable']}),
    disable: Flags.boolean({description: 'Turn AI chat off', exclusive: ['enable']}),
    llm: Flags.string({description: 'Default LLM integration ID (see `ai llms`)'}),
    model: Flags.string({description: 'Default model of that integration'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectAiSettingsSet)
    if (!flags.enable && !flags.disable && !flags.llm && !flags.model) {
      this.error('Pass --enable, --disable, --llm or --model.')
    }

    const {client, reader, projectId} = this.projectClient(flags)

    const current = ((await reader.hub.account.getProjectAiSettings({projectId})) as {result?: AiSettings}).result ?? {}
    const res = await client.hub.account.updateProjectAiSettings({
      projectId,
      enabled: flags.enable ? true : flags.disable ? false : (current.enabled ?? false),
      defaultLlmIntegrationId: flags.llm ?? current.defaultLlmIntegrationId,
      defaultModel: flags.model ?? current.defaultModel,
    })

    this.print('AI settings saved.')
    return res
  }
}
