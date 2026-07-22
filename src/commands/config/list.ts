import {BaseCommand} from '../../base.js'
import {configFilePath, redact} from '../../lib/store.js'

export default class ConfigList extends BaseCommand {
  static description = 'Show the local CLI configuration (secrets redacted)'

  static examples = ['<%= config.bin %> config list']

  async run(): Promise<unknown> {
    await this.parse(ConfigList)
    const stored = this.readStore()

    const display = {
      ...stored,
      apiKey: redact(stored.apiKey),
      bearerToken: redact(stored.bearerToken),
      refreshToken: redact(stored.refreshToken),
    }

    this.print({file: configFilePath(this.config.configDir), ...display})
    return display
  }
}
