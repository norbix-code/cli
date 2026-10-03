import {BaseCommand} from '../../base.js'

export default class AiServiceUsers extends BaseCommand {
  static description = `List the account's AI service users

An AI service user is the identity an AI client (an MCP client with an API
key) acts under, with a fixed reach, rights and environments. Keys are shown as
an id and a short hint, never the key itself.`

  static examples = ['<%= config.bin %> ai service-users']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiServiceUsers)
    const client = this.client(flags, {requireProject: false})

    const res = await client.hub.account.listAiServiceUsers({})

    this.print(res)
    return res
  }
}
