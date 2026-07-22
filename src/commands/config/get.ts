import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {SETTABLE_KEYS, isSettableKey, redact} from '../../lib/store.js'

export default class ConfigGet extends BaseCommand {
  static description = 'Print one configuration value'

  static examples = ['<%= config.bin %> config get projectId']

  static args = {
    key: Args.string({required: true, description: `One of: ${SETTABLE_KEYS.join(', ')}`}),
  }

  async run(): Promise<unknown> {
    const {args} = await this.parse(ConfigGet)
    if (!isSettableKey(args.key)) {
      this.error(`Unknown key "${args.key}". Valid keys: ${SETTABLE_KEYS.join(', ')}`)
    }

    const stored = this.readStore()
    const value = args.key === 'apiKey' ? redact(stored.apiKey) : stored[args.key]
    this.print(value ?? '(not set)')
    return {key: args.key, value}
  }
}
