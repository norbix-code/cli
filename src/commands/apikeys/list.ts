import {BaseCommand} from '../../base.js'

export default class ApikeysList extends BaseCommand {
  static description = "Show the project's API keys for the current environment"

  static examples = ['<%= config.bin %> apikeys list', '<%= config.bin %> apikeys list --env TEST']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ApikeysList)
    const client = this.client(flags)

    const res = await client.api.apikeys.getApiKeys({environment: flags.env})
    this.print(res)
    return res
  }
}
