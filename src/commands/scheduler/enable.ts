import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SchedulerEnable extends BaseCommand {
  static description = 'Enable a scheduler task'

  static examples = [
    '<%= config.bin %> scheduler enable 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> scheduler enable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Task ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SchedulerEnable)
    const client = this.client(flags)

    const res = await client.hub.scheduler.enableSchedulerTask({id: args.id})
    this.print(`Task ${args.id} enabled.`)
    return res
  }
}
