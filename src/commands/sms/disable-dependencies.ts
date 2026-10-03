import {BaseCommand} from '../../base.js'

export default class SmsDisableDependencies extends BaseCommand {
  static description = 'List what still depends on SMS — check this before `sms disable`'

  static examples = ['<%= config.bin %> sms disable-dependencies']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SmsDisableDependencies)
    const client = this.client(flags)

    const res = await client.hub.notifications.getSmsDisableDependencies({})

    this.print(res)
    return res
  }
}
