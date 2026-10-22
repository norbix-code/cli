import {EnvAdminUrlCommand} from '../../../lib/env-admin-url-command.js'

export default class EnvAdminUrlShow extends EnvAdminUrlCommand {
  static description = `Show where the --env environment's e-mail links point

Password-reset, magic-link and invitation e-mails open the environment's admin
portal. The answer has the environment's own URL (adminUrl), the address the
links really use (effectiveAdminUrl) and where it came from (source):
environment (its own URL), project (the project admin URL), hosted (the
Norbix-hosted portal) or cloud / none (the links cannot be opened).`

  static examples = [
    '<%= config.bin %> env admin-url show --env TEST',
    '<%= config.bin %> env admin-url show --prod --json',
  ]

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EnvAdminUrlShow)
    const item = await this.readAdminUrl(flags)
    this.show(item)
    return item
  }
}
