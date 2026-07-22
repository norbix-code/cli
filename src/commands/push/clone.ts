import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushClone extends BaseCommand {
  static description = 'Clone a push template'

  static examples = ['<%= config.bin %> push clone 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushClone)
    const client = this.client(flags)

    const res = await client.hub.notifications.clonePushTemplate({id: args.id})
    this.print(`Template ${args.id} cloned.`)
    return res
  }
}
