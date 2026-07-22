import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SchedulerDisable extends BaseCommand {
  static description = 'Disable a scheduler task'

  static examples = ['<%= config.bin %> scheduler disable 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Task ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SchedulerDisable)
    const client = this.client(flags)

    const res = await client.hub.scheduler.disableSchedulerTask({id: args.id})
    this.print(`Task ${args.id} disabled.`)
    return res
  }
}
