import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SmsTemplate extends BaseCommand {
  static description = 'Show one SMS template'

  static examples = ['<%= config.bin %> sms template 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsTemplate)
    const client = this.client(flags)

    const res = await client.hub.notifications.getSmsTemplate({id: args.id})

    this.print(res)
    return res
  }
}
