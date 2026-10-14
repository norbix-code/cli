import {BaseCommand} from '../../base.js'

export default class EnvList extends BaseCommand {
  static description = `List the project's environments (PROD is always first)

When the project has more than one, every project-scoped command needs --env <name>
(or --prod, NORBIX_ENV, or a default saved with \`norbix env use\`). With only PROD, no env is needed.`

  static examples = ['<%= config.bin %> env list', '<%= config.bin %> env list --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EnvList)
    const client = this.client(flags)

    const res = await client.hub.environments.list()
    // A fresh list: the env rule of the next commands uses it.
    this.rememberEnvs(this.resolveContext(flags), res)
    this.print(res)
    return res
  }
}
