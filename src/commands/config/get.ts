import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {PROFILE_KEYS, profileKey, readProfiles} from '../../lib/profiles.js'
import {redact} from '../../lib/store.js'

export default class ConfigGet extends BaseCommand {
  static description = `Print one value of a profile in ~/.norbix/config ([default] without --profile)`

  static examples = ['<%= config.bin %> config get project_id', '<%= config.bin %> config get region --profile ci']

  static args = {
    key: Args.string({required: true, description: `One of: ${PROFILE_KEYS.join(', ')}`}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ConfigGet)
    const key = profileKey(args.key)
    if (!key) this.error(`Unknown key "${args.key}". Valid keys: ${PROFILE_KEYS.join(', ')}`)
    const profile = flags.profile ?? 'default'

    const raw = readProfiles()[profile]?.[key]
    const value = key === 'api_key' ? redact(raw) : raw
    this.print(value ?? '(not set)')
    return {profile, key, value}
  }
}
