
import {BaseCommand} from '../../base.js'

export default class PushDisable extends BaseCommand {
  static description = `Turn off the push module for the project

Run \`push disable-dependencies\` first to see what still depends on push.`

  static examples = [
    '<%= config.bin %> push disable --yes',
    '<%= config.bin %> push disable --dry-run',
  ]

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushDisable)
    const client = this.client(flags)

    await this.confirmOrFail('Turn off push for this project?', flags)

    const res = await client.hub.notifications.disablePush({})

    this.print('Push disabled.')
    return res
  }
}
