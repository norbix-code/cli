import {BaseCommand} from '../../base.js'

export default class PushEnable extends BaseCommand {
  static description = 'Turn on the push module for the project'

  static examples = ['<%= config.bin %> push enable']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushEnable)
    const client = this.client(flags)

    const res = await client.hub.notifications.enablePush({})

    this.print('Push enabled.')
    return res
  }
}
