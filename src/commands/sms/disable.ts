import {confirm} from '@inquirer/prompts'
import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SmsDisable extends BaseCommand {
  static description = `Turn off the SMS module for the project

Run \`sms disable-dependencies\` first to see what still depends on SMS.`

  static examples = ['<%= config.bin %> sms disable --yes']

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SmsDisable)
    const client = this.client(flags)

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({message: 'Turn off SMS for this project?', default: false})
      if (!ok) return this.print('Cancelled.')
    }

    const res = await client.hub.notifications.disableSms({})

    this.print('SMS disabled.')
    return res
  }
}
