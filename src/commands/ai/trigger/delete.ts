import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiTriggerDelete extends BaseCommand {
  static description = 'Delete a AI trigger'

  static examples = [
    '<%= config.bin %> ai trigger delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> ai trigger delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiTriggerDelete)
    const client = this.client(flags)
    await this.confirmOrFail(`Delete AI trigger ${args.id}?`, flags)

    // The server sets the trigger type from the route (Ai).
    const res = await client.hub.ai.deleteAiProjectTrigger({triggerId: args.id})

    this.print(`Trigger ${args.id} deleted.`)
    return res
  }
}
