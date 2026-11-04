import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class AiTrigger extends BaseCommand {
  static description = 'Show one AI trigger'

  static examples = ['<%= config.bin %> ai trigger 66b2f0a1c3d4e5f6a7b8c9d0', '<%= config.bin %> ai trigger 66b2f0a1c3d4e5f6a7b8c9d0 --json']

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiTrigger)
    const client = this.client(flags)

    const res = await client.hub.ai.getAiProjectTrigger({id: args.id})

    this.print(res)
    return res
  }
}
