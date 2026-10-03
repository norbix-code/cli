import {BaseCommand} from '../../base.js'

export default class SmsEnable extends BaseCommand {
  static description = 'Turn on the SMS module for the project'

  static examples = [
    '<%= config.bin %> sms enable',
    '<%= config.bin %> sms enable --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SmsEnable)
    const client = this.client(flags)

    const res = await client.hub.notifications.enableSms({})

    this.print('SMS enabled.')
    return res
  }
}
