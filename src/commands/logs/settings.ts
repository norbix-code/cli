import {BaseCommand} from '../../base.js'

export default class LogsSettings extends BaseCommand {
  static description = 'Show project log settings'

  static examples = ['<%= config.bin %> logs settings']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(LogsSettings)
    const client = this.client(flags)

    const res = await client.hub.logs.getLogSettings({
    })

    this.print(res)
    return res
  }
}
