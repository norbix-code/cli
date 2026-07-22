import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushUnarchive extends BaseCommand {
  static description = 'Restore an archived push template'

  static examples = ['<%= config.bin %> push unarchive 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushUnarchive)
    const client = this.client(flags)

    const res = await client.hub.notifications.unArchivePushTemplate({id: args.id})
    this.print(`Template ${args.id} restored.`)
    return res
  }
}
