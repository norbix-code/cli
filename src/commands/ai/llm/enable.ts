import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiLlmEnable extends BaseCommand {
  static description = 'Turn on an LLM integration'

  static examples = ['<%= config.bin %> ai llm enable 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiLlmEnable)
    const client = this.client(flags)

    const res = await client.hub.ai.enableLlmIntegration({id: args.id})

    this.print(`Integration ${args.id} enabled.`)
    return res
  }
}
