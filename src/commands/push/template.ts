import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushTemplate extends BaseCommand {
  static description = 'Show one push template'

  static examples = ['<%= config.bin %> push template 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushTemplate)
    const client = this.client(flags)

    const res = await client.hub.notifications.getPushTemplate({id: args.id})

    this.print(res)
    return res
  }
}
