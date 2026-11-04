import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiTriggerDisable extends BaseCommand {
  static description = 'Turn a AI trigger off'

  static examples = [
    '<%= config.bin %> ai trigger disable 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> ai trigger disable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiTriggerDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Turn off AI trigger ${args.id}?`, flags)

    // The server sets the trigger type from the route (Ai).
    const res = await client.hub.ai.disableAiProjectTrigger({triggerId: args.id})

    this.print(`Trigger ${args.id} disabled.`)
    return res
  }
}
