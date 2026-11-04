import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class FilesTriggerEnable extends BaseCommand {
  static description = 'Turn a files trigger on'

  static examples = [
    '<%= config.bin %> files trigger enable 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> files trigger enable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesTriggerEnable)
    const client = this.client(flags)
    // The server sets the trigger type from the route (Files).
    const res = await client.hub.files.enableFilesTrigger({triggerId: args.id})

    this.print(`Trigger ${args.id} enabled.`)
    return res
  }
}
