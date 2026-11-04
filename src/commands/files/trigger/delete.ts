import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class FilesTriggerDelete extends BaseCommand {
  static description = 'Delete a files trigger'

  static examples = [
    '<%= config.bin %> files trigger delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> files trigger delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesTriggerDelete)
    const client = this.client(flags)
    await this.confirmOrFail(`Delete files trigger ${args.id}?`, flags)

    // The server sets the trigger type from the route (Files).
    const res = await client.hub.files.deleteFilesTrigger({triggerId: args.id})

    this.print(`Trigger ${args.id} deleted.`)
    return res
  }
}
