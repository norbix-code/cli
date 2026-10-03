import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class SmsTemplateTokens extends BaseCommand {
  static description = 'List the tokens an SMS template uses — the values a campaign must fill'

  static examples = ['<%= config.bin %> sms template tokens 66b2f0a1c3d4e5f6a7b8c9d0']

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsTemplateTokens)
    const client = this.client(flags)

    const res = await client.hub.notifications.getSmsMessageContentTokens({id: args.id})

    this.print(res)
    return res
  }
}
