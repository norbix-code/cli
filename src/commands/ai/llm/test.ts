import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiLlmTest extends BaseCommand {
  static description = 'Check that an LLM integration works: a live call to the provider'

  static examples = ['<%= config.bin %> ai llm test 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiLlmTest)
    const client = this.client(flags)

    const res = await client.hub.ai.testLlmIntegration({integrationId: args.id})

    this.print(res)
    return res
  }
}
