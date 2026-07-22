import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailArchive extends BaseCommand {
  static description = 'Archive an email template'

  static examples = ['<%= config.bin %> email archive 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailArchive)
    const client = this.client(flags)

    const res = await client.hub.notifications.archiveEmailTemplate({id: args.id})
    this.print(`Template ${args.id} archived.`)
    return res
  }
}
