import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailUnarchive extends BaseCommand {
  static description = 'Restore an archived email template'

  static examples = ['<%= config.bin %> email unarchive 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailUnarchive)
    const client = this.client(flags)

    const res = await client.hub.notifications.unArchiveEmailTemplate({id: args.id})
    this.print(`Template ${args.id} restored.`)
    return res
  }
}
