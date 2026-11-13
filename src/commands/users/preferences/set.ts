import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class UsersPreferencesSet extends BaseCommand {
  static description = `Block or allow every marketing message to a login`

  static examples = [
    '<%= config.bin %> users preferences set usr_66b2f0a1c3d4 --block-marketing true',
    '<%= config.bin %> users preferences set usr_66b2f0a1c3d4 --block-marketing false --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Login ID (usr_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    'block-marketing': Flags.string({required: true, description: 'true = no marketing messages at all', options: ['true', 'false']}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersPreferencesSet)
    const block = flags['block-marketing'] === 'true'
    const client = this.client(flags)

    const res = await client.api.membership.updateUserPreferences({id: args.id, blockAllMarketingMessages: block})
    this.print(block ? `Login ${args.id} gets no marketing messages now.` : `Login ${args.id} can get marketing messages again.`)
    return res
  }
}
