import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailSystemTemplate extends BaseCommand {
  static description = 'Show one ready-made (system) email template'

  static examples = ['<%= config.bin %> email system-template 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'System template ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailSystemTemplate)
    const client = this.client(flags)

    const res = await client.hub.notifications.getSystemEmailTemplate({id: args.id})

    this.print(res)
    return res
  }
}
