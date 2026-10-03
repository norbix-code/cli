import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailSignature extends BaseCommand {
  static description = 'Show one email signature'

  static examples = ['<%= config.bin %> email signature 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Signature ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailSignature)
    const client = this.client(flags)

    const res = await client.hub.notifications.getEmailSignature({id: args.id})

    this.print(res)
    return res
  }
}
