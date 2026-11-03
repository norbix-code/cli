import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class CodeIntegrationEnable extends BaseCommand {
  static description = 'Turn a code integration on'

  static examples = [
    '<%= config.bin %> code integration enable 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> code integration enable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeIntegrationEnable)
    const client = this.client(flags)

    // The route token is `{Id}`; the SDK fills it from `id` (the lookup is
    // case-insensitive), so the generated field is enough.
    const res = await client.hub.code.enableCodeIntegration({id: args.id})

    this.print(`Integration ${args.id} enabled.`)
    return res
  }
}
