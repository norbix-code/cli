import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushArchive extends BaseCommand {
  static description = 'Archive a push template'

  static examples = ['<%= config.bin %> push archive 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushArchive)
    const client = this.client(flags)

    const res = await client.hub.notifications.archivePushTemplate({id: args.id})
    this.print(`Template ${args.id} archived.`)
    return res
  }
}
