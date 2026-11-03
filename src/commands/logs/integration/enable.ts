import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class LogsIntegrationEnable extends BaseCommand {
  static description = 'Turn a logs integration on'

  static examples = [
    '<%= config.bin %> logs integration enable 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> logs integration enable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(LogsIntegrationEnable)
    const client = this.client(flags)

    // The route token is `{Id}`; the SDK fills it from `id` (the lookup is
    // case-insensitive), so the generated field is enough.
    const res = await client.hub.logs.enableLoggingIntegration({id: args.id})

    this.print(`Integration ${args.id} enabled.`)
    return res
  }
}
