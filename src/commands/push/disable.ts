import {confirm} from '@inquirer/prompts'
import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushDisable extends BaseCommand {
  static description = `Turn off the push module for the project

Run \`push disable-dependencies\` first to see what still depends on push.`

  static examples = ['<%= config.bin %> push disable --yes']

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushDisable)
    const client = this.client(flags)

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({message: 'Turn off push for this project?', default: false})
      if (!ok) return this.print('Cancelled.')
    }

    const res = await client.hub.notifications.disablePush({})

    this.print('Push disabled.')
    return res
  }
}
