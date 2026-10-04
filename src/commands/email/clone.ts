import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailClone extends BaseCommand {
  static description = 'Clone an email template'

  static examples = [
    '<%= config.bin %> email clone 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> email clone 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailClone)
    const client = this.client(flags)

    const res = await client.hub.notifications.cloneEmailTemplate({id: args.id})
    this.print(`Template ${args.id} cloned.`)
    return res
  }
}
