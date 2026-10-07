import {existsSync} from 'node:fs'

import {BaseCommand} from '../../base.js'
import {PROFILES_PATH, readProfiles} from '../../lib/profiles.js'
import {configFilePath, redact} from '../../lib/store.js'

export default class ConfigList extends BaseCommand {
  static description = `Show a profile of ~/.norbix/config ([default] without --profile), secrets redacted

\`norbix profiles\` lists every profile and the login session. When the old
~/.config/norbix/config.json still exists, it is shown too: the CLI only
reads it as a last fallback and never writes it.`

  static examples = ['<%= config.bin %> config list', '<%= config.bin %> config list --profile ci']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ConfigList)
    const profile = flags.profile ?? 'default'
    const values = readProfiles()[profile] ?? {}
    const display = {...values, api_key: redact(values.api_key)}

    const legacyPath = configFilePath(this.config.configDir)
    const legacy = existsSync(legacyPath) ? this.readStore() : undefined
    const legacyDisplay = legacy
      ? {
          file: legacyPath,
          note: 'old file, read only as a fallback — move these values with `norbix config set`',
          ...legacy,
          apiKey: redact(legacy.apiKey),
          bearerToken: redact(legacy.bearerToken),
          refreshToken: redact(legacy.refreshToken),
        }
      : undefined

    this.print({file: PROFILES_PATH, profile, ...display, ...(legacyDisplay ? {legacy: legacyDisplay} : {})})
    return {profile, values: display, ...(legacyDisplay ? {legacy: legacyDisplay} : {})}
  }
}
