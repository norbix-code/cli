import {confirm} from '@inquirer/prompts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailFooterDelete extends BaseCommand {
  static description = 'Delete an email footer'

  static examples = ['<%= config.bin %> email footer delete 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'Footer ID'}),
  }

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailFooterDelete)
    const client = this.client(flags)

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({message: `Delete email footer ${args.id}?`, default: false})
      if (!ok) return this.print('Cancelled.')
    }

    const res = await client.hub.notifications.deleteEmailFooter({id: args.id})

    this.print(`Footer ${args.id} deleted.`)
    return res
  }
}
