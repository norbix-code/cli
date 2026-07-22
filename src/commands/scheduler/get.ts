import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SchedulerGet extends BaseCommand {
  static description = 'Show one scheduler task'

  static examples = ['<%= config.bin %> scheduler get 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Task ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SchedulerGet)
    const client = this.client(flags)

    const res = await client.hub.scheduler.getSchedulerTask({id: args.id})
    this.print(res)
    return res
  }
}
