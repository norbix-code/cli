import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class LogsIntegrationDisable extends BaseCommand {
  static description = 'Turn a logs integration off'

  static examples = [
    '<%= config.bin %> logs integration disable 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> logs integration disable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(LogsIntegrationDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Turn off logs integration ${args.id}?`, flags)

    // The route token is `{Id}`; the SDK fills it from `id` (the lookup is
    // case-insensitive), so the generated field is enough.
    const res = await client.hub.logs.disableLoggingIntegration({id: args.id})

    this.print(`Integration ${args.id} disabled.`)
    return res
  }
}
