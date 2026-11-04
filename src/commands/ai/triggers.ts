import {BaseCommand} from '../../base.js'

export default class AiTriggers extends BaseCommand {
  static description = 'List the AI triggers'

  static examples = ['<%= config.bin %> ai triggers', '<%= config.bin %> ai triggers --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiTriggers)
    const client = this.client(flags)

    const res = await client.hub.ai.getAiProjectTriggers({})

    this.print(res)
    return res
  }
}
