import {confirm} from '@inquirer/prompts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EnvDelete extends BaseCommand {
  static description = 'Delete a non-PROD environment (cascades its integrations)'

  static examples = ['<%= config.bin %> env delete STAGING --yes']

  static args = {
    name: Args.string({required: true, description: 'Environment name (PROD cannot be deleted)'}),
  }

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EnvDelete)
    const client = this.client(flags)

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({
        message: `Delete environment "${args.name}" and everything inside it?`,
        default: false,
      })
      if (!ok) return this.print('Cancelled.')
    }

    const res = await client.hub.environments.delete({environmentName: args.name})
    this.print(`Environment ${args.name} deleted.`)
    return res
  }
}
