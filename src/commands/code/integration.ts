import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class CodeIntegration extends BaseCommand {
  static description = 'Show one code integration'

  static examples = ['<%= config.bin %> code integration 66b2f0a1c3d4e5f6a7b8c9d0']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeIntegration)
    const client = this.client(flags)

    const res = await client.hub.code.getCodeIntegration({id: args.id})

    this.print(res)
    return res
  }
}
