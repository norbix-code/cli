import {BaseCommand} from '../../../base.js'
import {EnvAdminUrlCommand} from '../../../lib/env-admin-url-command.js'

export default class EnvAdminUrlClear extends EnvAdminUrlCommand {
  static description = `Remove the --env environment's own admin portal address

Its e-mail links then use the project admin URL (\`project admin-portal set-url\`),
then the Norbix-hosted portal. Its origin leaves CORS again.`

  static examples = [
    '<%= config.bin %> env admin-url clear --env TEST',
    '<%= config.bin %> env admin-url clear --env TEST --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EnvAdminUrlClear)
    return this.writeAdminUrl(flags, '')
  }
}
