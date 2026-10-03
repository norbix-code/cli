import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SmsIntegration extends BaseCommand {
  static description = 'Show one SMS integration'

  static examples = ['<%= config.bin %> sms integration 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsIntegration)
    const client = this.client(flags)

    const res = await client.hub.notifications.getSmsIntegration({id: args.id})

    this.print(res)
    return res
  }
}
