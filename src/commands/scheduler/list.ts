import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SchedulerList extends BaseCommand {
  static description = 'List scheduler tasks'

  static examples = ['<%= config.bin %> scheduler list']

  static flags = {
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SchedulerList)
    const client = this.client(flags)

    const res = await client.hub.scheduler.getSchedulerTasks({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
