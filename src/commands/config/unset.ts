import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {PROFILES_PATH, PROFILE_KEYS, profileKey, readProfiles, writeProfile} from '../../lib/profiles.js'

export default class ConfigUnset extends BaseCommand {
  static description = `Remove one value from a profile in ~/.norbix/config ([default] without --profile)`

  static examples = ['<%= config.bin %> config unset region', '<%= config.bin %> config unset hub_url --profile local --dry-run']

  static args = {
    key: Args.string({required: true, description: `One of: ${PROFILE_KEYS.join(', ')}`}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ConfigUnset)
    const key = profileKey(args.key)
    if (!key) this.error(`Unknown key "${args.key}". Valid keys: ${PROFILE_KEYS.join(', ')}`)
    const profile = flags.profile ?? 'default'

    if (flags['dry-run']) {
      return this.dryRun({method: 'config.unset', request: {file: PROFILES_PATH, profile, key}})
    }

    const existing = readProfiles()[profile]
    if (existing) writeProfile(profile, {...existing, [key]: undefined})
    this.print(`[${profile}] ${key} removed.`)
    return {profile, key, removed: true}
  }
}
