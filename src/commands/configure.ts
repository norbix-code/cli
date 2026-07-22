import {input, password as passwordPrompt} from '@inquirer/prompts'
import {Flags} from '@oclif/core'

import {BaseCommand} from '../base.js'
import {
  DEFAULT_API_URL,
  DEFAULT_HUB_URL,
  PROFILES_PATH,
  readProfiles,
  writeProfile,
} from '../lib/profiles.js'
import {redact} from '../lib/store.js'

export default class Configure extends BaseCommand {
  static description = `Set up a profile in ~/.norbix/config (like \`aws configure\`).

Asks for a service-user API key, project ID, and optional account ID and
environment. Use --profile to create or edit a named profile; without it the
[default] profile is written. Later, run any command with
--profile <name> to use exactly that profile.`

  static examples = [
    '<%= config.bin %> configure',
    '<%= config.bin %> configure --profile fitskin-prod',
    '<%= config.bin %> configure --profile localhost --api-url http://localhost:5001 --hub-url http://localhost:5002',
  ]

  static flags = {
    'api-url': Flags.string({description: `API endpoint (default: ${DEFAULT_API_URL})`}),
    'hub-url': Flags.string({description: `Hub endpoint (default: ${DEFAULT_HUB_URL})`}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(Configure)
    const name = flags.profile ?? 'default'
    const existing = readProfiles()[name] ?? {}

    this.log(`Configuring profile [${name}] in ${PROFILES_PATH}`)

    // Same interaction style as `aws configure`: show the current value
    // (redacted for the key), keep it when the user just presses ENTER.
    const keyLabel = existing.api_key
      ? `Service user API key [${redact(existing.api_key)}]:`
      : 'Service user API key:'
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

    // With the default norbix.ai endpoints the region is REQUIRED (requests
    // go to <region>.api.norbix.ai). With custom endpoints it is optional.
    const usesDefaultEndpoints = !(flags['api-url'] ?? existing.api_url) && !(flags['hub-url'] ?? existing.hub_url)
    const region =
      (await input({
        message: usesDefaultEndpoints
          ? 'Region (REQUIRED, e.g. nb-eu-germany):'
          : 'Region (optional with custom endpoints):',
        default: existing.region ?? '',
        validate: (v) => (!usesDefaultEndpoints || v.trim() ? true : 'Region is required when using the default norbix.ai endpoints.'),
      })) || undefined

    writeProfile(name, {
      api_key: apiKey,
      project_id: projectId,
      account_id: accountId,
      env,
      region,
      api_url: flags['api-url'] ?? existing.api_url,
      hub_url: flags['hub-url'] ?? existing.hub_url,
      files_integration_id: existing.files_integration_id,
    })

    this.log(`Profile [${name}] saved.`)
    if (name !== 'default') this.log(`Use it with: norbix <command> --profile ${name}`)
    return {profile: name, saved: true}
  }
}
