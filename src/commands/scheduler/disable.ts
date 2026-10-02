import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SchedulerDisable extends BaseCommand {
  static description = 'Disable a scheduler task'

  static examples = [
    '<%= config.bin %> scheduler disable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
    '<%= config.bin %> scheduler disable 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
  ]

  static args = {
    id: Args.string({required: true, description: 'Task ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SchedulerDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Disable scheduler task ${args.id}?`, flags)

    const res = await client.hub.scheduler.disableSchedulerTask({id: args.id})
    this.print(`Task ${args.id} disabled.`)
    return res
  }
}
