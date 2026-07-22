import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SmsClone extends BaseCommand {
  static description = 'Clone an SMS template'

  static examples = ['<%= config.bin %> sms clone 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsClone)
    const client = this.client(flags)

    const res = await client.hub.notifications.cloneSmsTemplate({id: args.id})
    this.print(`Template ${args.id} cloned.`)
    return res
  }
}
