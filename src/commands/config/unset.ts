import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {SETTABLE_KEYS, configFilePath, isSettableKey, writeStore} from '../../lib/store.js'

export default class ConfigUnset extends BaseCommand {
  static description = 'Remove one configuration value'

  static examples = ['<%= config.bin %> config unset region', '<%= config.bin %> config unset region --dry-run']

  static args = {
    key: Args.string({required: true, description: `One of: ${SETTABLE_KEYS.join(', ')}`}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ConfigUnset)
    if (!isSettableKey(args.key)) {
      this.error(`Unknown key "${args.key}". Valid keys: ${SETTABLE_KEYS.join(', ')}`)
    }

    if (flags['dry-run']) {
      return this.dryRun({method: 'config.unset', request: {file: configFilePath(this.config.configDir), key: args.key}})
    }

    const stored = this.readStore()
    writeStore(this.config.configDir, {...stored, [args.key]: undefined})
    this.print(`${args.key} removed.`)
    return {key: args.key, removed: true}
  }
}
