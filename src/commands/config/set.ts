import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {SETTABLE_KEYS, isSettableKey, writeStore} from '../../lib/store.js'

export default class ConfigSet extends BaseCommand {
  static description = 'Set one configuration value'

  static examples = [
    '<%= config.bin %> config set projectId 5f1a9f7e...',
    '<%= config.bin %> config set region nb-eu-germany',
    '<%= config.bin %> config set env TEST',
  ]

  static args = {
    key: Args.string({required: true, description: `One of: ${SETTABLE_KEYS.join(', ')}`}),
    value: Args.string({required: true, description: 'New value'}),
  }

  async run(): Promise<unknown> {
    const {args} = await this.parse(ConfigSet)
    if (!isSettableKey(args.key)) {
      this.error(`Unknown key "${args.key}". Valid keys: ${SETTABLE_KEYS.join(', ')}`)
    }

    const stored = this.readStore()
    writeStore(this.config.configDir, {...stored, [args.key]: args.value})
    this.print(`${args.key} = ${args.key === 'apiKey' ? '(saved)' : args.value}`)
    return {key: args.key, saved: true}
  }
}
