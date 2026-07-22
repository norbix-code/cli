import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailTemplate extends BaseCommand {
  static description = 'Show one email template'

  static examples = ['<%= config.bin %> email template 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailTemplate)
    const client = this.client(flags)

    const res = await client.hub.notifications.getEmailTemplate({id: args.id})

    this.print(res)
    return res
  }
}
