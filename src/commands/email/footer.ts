import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailFooter extends BaseCommand {
  static description = 'Show one email footer'

  static examples = ['<%= config.bin %> email footer 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Footer ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailFooter)
    const client = this.client(flags)

    const res = await client.hub.notifications.getEmailFooter({id: args.id})

    this.print(res)
    return res
  }
}
