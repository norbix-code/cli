import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {SETTABLE_KEYS, configFilePath, isSettableKey, writeStore} from '../../lib/store.js'

export default class ConfigSet extends BaseCommand {
  static description = 'Set one configuration value'

  static examples = [
    '<%= config.bin %> config set projectId 5f1a9f7e2b3c4d5e6f708192',
    '<%= config.bin %> config set region nb-eu-germany',
    '<%= config.bin %> config set env TEST',
    '<%= config.bin %> config set region nb-eu-germany --dry-run',
  ]

  static args = {
    key: Args.string({required: true, description: `One of: ${SETTABLE_KEYS.join(', ')}`}),
    value: Args.string({required: true, description: 'New value'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ConfigSet)
    if (!isSettableKey(args.key)) {
      this.error(`Unknown key "${args.key}". Valid keys: ${SETTABLE_KEYS.join(', ')}`)
    }

    if (flags['dry-run']) {
      return this.dryRun({
        method: 'config.set',
        request: {file: configFilePath(this.config.configDir), key: args.key, value: args.key === 'apiKey' ? '***' : args.value},
      })
    }

    const stored = this.readStore()
    writeStore(this.config.configDir, {...stored, [args.key]: args.value})
    this.print(`${args.key} = ${args.key === 'apiKey' ? '(saved)' : args.value}`)
    return {key: args.key, saved: true}
  }
}
