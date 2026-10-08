import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {storedHost} from '../../lib/hosts.js'
import {PROFILES_PATH, PROFILE_KEYS, profileKey, readProfiles, writeProfile} from '../../lib/profiles.js'

export default class ConfigSet extends BaseCommand {
  static description = `Set one value in a profile of ~/.norbix/config

Without --profile the [default] profile is written (and created when missing).
Keys are written as in the file (project_id); the camelCase name (projectId)
is accepted too. \`host\` is your dashboard or Hub address (https, or http
for localhost and *.test names); setting it removes the deprecated api_url / hub_url.`

  static examples = [
    '<%= config.bin %> config set project_id 5f1a9f7e2b3c4d5e6f708192',
    '<%= config.bin %> config set region nb-eu-germany --profile ci',
    '<%= config.bin %> config set host cloud.example.com --profile example',
    '<%= config.bin %> config set host localhost:5001 --profile local',
    '<%= config.bin %> config set env TEST --dry-run',
  ]

  static args = {
    key: Args.string({required: true, description: `One of: ${PROFILE_KEYS.join(', ')}`}),
    value: Args.string({required: true, description: 'New value'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  static discoversHost = false

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ConfigSet)
    const key = profileKey(args.key)
    if (!key) this.error(`Unknown key "${args.key}". Valid keys: ${PROFILE_KEYS.join(', ')}`)
    const profile = flags.profile ?? 'default'
    const value = key === 'host' ? storedHost(args.value) : args.value
    const shown = key === 'api_key' ? '***' : value

    if (flags['dry-run']) {
      return this.dryRun({method: 'config.set', request: {file: PROFILES_PATH, profile, key, value: shown}})
    }

    const next = {...readProfiles()[profile], [key]: value}
    if (key === 'host') {
      delete next.api_url
      delete next.hub_url
    }

    writeProfile(profile, next)
    this.print(`[${profile}] ${key} = ${key === 'api_key' ? '(saved)' : value}`)
    return {profile, key, saved: true}
  }
}
