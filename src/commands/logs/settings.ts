import {BaseCommand} from '../../base.js'

/** The storage self-check fields of `GET /logs/settings` (gateway N48). */
interface LogSettingsSelfCheck {
  env?: string
  hasNorbixLogging?: boolean
  lastEntryAtUtc?: string
  lastStoredAtUtc?: string
  storageWarning?: string
}

export default class LogsSettings extends BaseCommand {
  static description = `Show project log settings for the --env environment

Each environment (PROD, TEST, …) has its own Norbix Logging integration. Besides
the flags, a hub with the N48 fix answers a storage self-check: when an entry of
this environment last reached the log writer (lastEntryAtUtc), when its Norbix
Logging integration last stored one (lastStoredAtUtc), and a warning when its
logs are not being stored.`

  static examples = ['<%= config.bin %> logs settings', '<%= config.bin %> logs settings --env TEST']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(LogsSettings)
    const client = this.client(flags)

    const res = await client.hub.logs.getLogSettings({
    })

    this.print(res)

    const check = res as LogSettingsSelfCheck
    if (check.storageWarning && !this.jsonEnabled()) {
      process.stderr.write(`Warning: ${check.storageWarning}\n`)
    }

    return res
  }
}
