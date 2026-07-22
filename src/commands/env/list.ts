import {BaseCommand} from '../../base.js'

export default class EnvList extends BaseCommand {
  static description = "List the project's environments (PROD is always first)"

  static examples = ['<%= config.bin %> env list']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EnvList)
    const client = this.client(flags)

    const res = await client.hub.environments.list()
    this.print(res)
    return res
  }
}
