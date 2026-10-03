import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class AiLlm extends BaseCommand {
  static description = 'Show one LLM integration'

  static examples = ['<%= config.bin %> ai llm 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiLlm)
    const client = this.client(flags)

    const res = await client.hub.ai.getLlmIntegration({id: args.id})

    this.print(res)
    return res
  }
}
