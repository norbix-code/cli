import {confirm} from '@inquirer/prompts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class UsersDelete extends BaseCommand {
  static description = 'Delete a user'

  static examples = ['<%= config.bin %> users delete 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'User ID'}),
  }

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersDelete)
    const client = this.client(flags)

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({message: `Delete user ${args.id}?`, default: false})
      if (!ok) return this.print('Cancelled.')
    }

    const res = await client.api.membership.deleteUser({id: args.id})
    this.print(`User ${args.id} deleted.`)
    return res
  }
}
