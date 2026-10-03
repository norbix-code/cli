import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiLlmDelete extends BaseCommand {
  static description = 'Delete an LLM integration'

  static examples = [
    '<%= config.bin %> ai llm delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> ai llm delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiLlmDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete LLM integration ${args.id}?`, flags)

    const res = await client.hub.ai.deleteLlmIntegration({id: args.id})

    this.print(`Integration ${args.id} deleted.`)
    return res
  }
}
