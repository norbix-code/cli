import {BaseCommand} from '../base.js'
import {usageError} from '../lib/cli-error.js'
import {DEFAULT_HOST, isDefaultHost, normalizeHost, storedHost} from '../lib/hosts.js'
import {PROFILES_PATH, readProfiles, writeProfile} from '../lib/profiles.js'
import {redact} from '../lib/store.js'

export default class Configure extends BaseCommand {
  static description = `Set up a profile in ~/.norbix/config (like \`aws configure\`).

Asks for the host (your Norbix dashboard or Hub address; empty =
hub.norbix.ai), a service-user API key (optional: without one the profile
uses the browser sign-in of its host — \`norbix login --profile <name>\`),
project ID, and optional account ID, environment and region. Use --profile
to create or edit a named profile; without it the [default] profile is
written. Later, run any command with --profile <name>.`

  static examples = [
    '<%= config.bin %> configure',
    '<%= config.bin %> configure --profile fitskin-prod',
    '<%= config.bin %> configure --profile example --host cloud.example.com',
    '<%= config.bin %> configure --profile local --host localhost:5001',
  ]

  static discoversHost = false

  async run(): Promise<unknown> {
    const {flags} = await this.parse(Configure)
    const name = flags.profile ?? 'default'
    const existing = readProfiles()[name] ?? {}

    if (!this.isInteractive()) {
      throw usageError(
        'configure is interactive and this shell is not.',
        `Write the profile without prompts: norbix login --api-key <key> --project <id> [--host <host>] --profile ${name}, ` +
          `or norbix config set <key> <value> --profile ${name}; or set NORBIX_HOST / NORBIX_API_KEY / NORBIX_PROJECT_ID in the environment.`,
        'norbix login --help',
      )
    }

    const {input, password: passwordPrompt} = await import('@inquirer/prompts')

    this.log(`Configuring profile [${name}] in ${PROFILES_PATH}`)

    // The host: the one address the CLI needs (the Hub tells it the rest).
    const legacyHost = existing.hub_url ? safeStoredHost(existing.hub_url) : undefined
    const hostInput =
      flags.host ??
      (await input({
        message: `Host — your Norbix dashboard or Hub (empty = ${DEFAULT_HOST}):`,
        default: existing.host ?? legacyHost ?? '',
        validate: (v) => {
          if (!v.trim()) return true
          try {
            normalizeHost(v)
            return true
          } catch (error) {
            return error instanceof Error ? error.message : String(error)
          }
        },
      }))
    const host = hostInput.trim() && !isDefaultHost(normalizeHost(hostInput)) ? storedHost(hostInput) : undefined

    // Same interaction style as `aws configure`: show the current value
    // (redacted for the key), keep it when the user just presses ENTER.
    const keyLabel = existing.api_key
      ? `Service user API key [${redact(existing.api_key)}]:`
      : 'Service user API key (empty = use the browser sign-in of this host):'
    const apiKeyInput = await passwordPrompt({message: keyLabel, mask: '*'})
    const apiKey = apiKeyInput || existing.api_key

    const projectId =
      (await input({message: 'Project ID:', default: existing.project_id})) || undefined

    const accountId =
      (await input({
        message: 'Account ID (optional, for account-level commands):',
        default: existing.account_id ?? '',
      })) || undefined

    const env =
      (await input({
        message: 'Environment (optional, empty = PROD):',
        default: existing.env ?? '',
      })) || undefined

    // On norbix.ai requests go to <region>.api.norbix.ai; when the region is
    // empty the CLI asks the Hub for the project's primary region.
    const region =
      (await input({
        message: host
          ? 'Region (optional on your own installation):'
          : "Region (e.g. nb-eu-germany; empty = the project's primary region):",
        default: existing.region ?? '',
      })) || undefined

    writeProfile(name, {
      host,
      api_key: apiKey,
      project_id: projectId,
      account_id: accountId,
      env,
      region,
      hub_version: existing.hub_version,
      files_integration_id: existing.files_integration_id,
    })

    this.log(`Profile [${name}] saved.`)
    if (name !== 'default') this.log(`Use it with: norbix <command> --profile ${name}`)
    return {profile: name, saved: true}
  }
}

/** The host of a deprecated hub_url, or undefined when it cannot be a host (plain http on a server). */
function safeStoredHost(url: string): string | undefined {
  try {
    return storedHost(new URL(url).origin)
  } catch {
    return undefined
  }
}
