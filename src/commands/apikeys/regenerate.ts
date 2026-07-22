import {confirm} from '@inquirer/prompts'
import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class ApikeysRegenerate extends BaseCommand {
  static description = 'Regenerate the API keys for the current environment (old keys stop working!)'

  static examples = ['<%= config.bin %> apikeys regenerate --yes']

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ApikeysRegenerate)
    const client = this.client(flags)

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({
        message: 'Regenerate API keys? Every service using the old keys will lose access.',
        default: false,
      })
      if (!ok) return this.print('Cancelled.')
    }

    const res = await client.api.apikeys.regenerateApiKeys({environment: flags.env})
    this.print(res)
    return res
  }
}
