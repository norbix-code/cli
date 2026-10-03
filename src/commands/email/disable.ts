import {confirm} from '@inquirer/prompts'
import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailDisable extends BaseCommand {
  static description = `Turn off the email module for the project

Run \`email disable-dependencies\` first to see what still depends on email.`

  static examples = ['<%= config.bin %> email disable --yes']

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailDisable)
    const client = this.client(flags)

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({message: 'Turn off email for this project?', default: false})
      if (!ok) return this.print('Cancelled.')
    }

    const res = await client.hub.notifications.disableEmail({})

    this.print('Email disabled.')
    return res
  }
}
