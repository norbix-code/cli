import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {SETTABLE_KEYS, isSettableKey, writeStore} from '../../lib/store.js'

export default class ConfigUnset extends BaseCommand {
  static description = 'Remove one configuration value'

  static examples = ['<%= config.bin %> config unset region']

  static args = {
    key: Args.string({required: true, description: `One of: ${SETTABLE_KEYS.join(', ')}`}),
  }

  async run(): Promise<unknown> {
    const {args} = await this.parse(ConfigUnset)
    if (!isSettableKey(args.key)) {
      this.error(`Unknown key "${args.key}". Valid keys: ${SETTABLE_KEYS.join(', ')}`)
    }

    const stored = this.readStore()
    writeStore(this.config.configDir, {...stored, [args.key]: undefined})
    this.print(`${args.key} removed.`)
    return {key: args.key, removed: true}
  }
}
