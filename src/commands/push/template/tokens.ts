import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PushTemplateTokens extends BaseCommand {
  static description = 'List the tokens a push template uses — the values a campaign must fill'

  static examples = ['<%= config.bin %> push template tokens 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushTemplateTokens)
    const client = this.client(flags)

    const res = await client.hub.notifications.getPushMessageContentTokens({id: args.id})

    this.print(res)
    return res
  }
}
