import {confirm} from '@inquirer/prompts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SchedulerDelete extends BaseCommand {
  static description = 'Delete a scheduler task'

  static examples = ['<%= config.bin %> scheduler delete 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'Task ID'}),
  }

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SchedulerDelete)
    const client = this.client(flags)

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({message: `Delete scheduler task ${args.id}?`, default: false})
      if (!ok) return this.print('Cancelled.')
    }

    const res = await client.hub.scheduler.deleteSchedulerTask({id: args.id})
    this.print(`Task ${args.id} deleted.`)
    return res
  }
}
