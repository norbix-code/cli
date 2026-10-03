import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiLlmDisable extends BaseCommand {
  static description = 'Turn off an LLM integration'

  static examples = [
    '<%= config.bin %> ai llm disable 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> ai llm disable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiLlmDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Turn off LLM integration ${args.id}?`, flags)

    const res = await client.hub.ai.disableLlmIntegration({id: args.id})

    this.print(`Integration ${args.id} disabled.`)
    return res
  }
}
