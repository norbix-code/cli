import {BaseCommand} from '../../base.js'

export default class SupportList extends BaseCommand {
  static description = "List your account's support cases — the ones you opened and the issues you reported"

  static examples = ['<%= config.bin %> support list', '<%= config.bin %> support list --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SupportList)
    const res = await this.client(flags).hub.support.getSupportCases({})
    this.print(res)
    return res
  }
}
