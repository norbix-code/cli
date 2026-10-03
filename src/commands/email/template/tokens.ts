import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailTemplateTokens extends BaseCommand {
  static description = 'List the tokens an email template uses'

  static examples = ['<%= config.bin %> email template tokens 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailTemplateTokens)
    const client = this.client(flags)

    const res = await client.hub.notifications.getEmailTemplateAvailableTokens({id: args.id})

    this.print(res)
    return res
  }
}
