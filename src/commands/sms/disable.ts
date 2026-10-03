import {BaseCommand} from '../../base.js'

export default class SmsDisable extends BaseCommand {
  static description = `Turn off the SMS module for the project

Run \`sms disable-dependencies\` first to see what still depends on SMS.`

  static examples = [
    '<%= config.bin %> sms disable --yes',
    '<%= config.bin %> sms disable --dry-run',
  ]

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SmsDisable)
    const client = this.client(flags)

    await this.confirmOrFail('Turn off SMS for this project?', flags)

    const res = await client.hub.notifications.disableSms({})

    this.print('SMS disabled.')
    return res
  }
}
