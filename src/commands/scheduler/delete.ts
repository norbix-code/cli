import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SchedulerDelete extends BaseCommand {
  static description = 'Delete a scheduler task'

  static examples = [
    '<%= config.bin %> scheduler delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> scheduler delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Task ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SchedulerDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete scheduler task ${args.id}?`, flags)

    const res = await client.hub.scheduler.deleteSchedulerTask({id: args.id})
    this.print(`Task ${args.id} deleted.`)
    return res
  }
}
