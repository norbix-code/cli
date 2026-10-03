import {confirm} from '@inquirer/prompts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailIntegrationDelete extends BaseCommand {
  static description = 'Delete an email integration'

  static examples = ['<%= config.bin %> email integration delete 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailIntegrationDelete)
    const client = this.client(flags)

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({message: `Delete email integration ${args.id}?`, default: false})
      if (!ok) return this.print('Cancelled.')
    }

    const res = await client.hub.notifications.deleteEmailIntegration({id: args.id})

    this.print(`Integration ${args.id} deleted.`)
    return res
  }
}
