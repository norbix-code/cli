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

    // The route token is `{Id}` and the transport fills tokens by exact name,
    // so the request must carry `Id`. The generated type calls the field `id`,
    // which throws NORBIX_MISSING_PATH_PARAM — hence the cast.
    const res = await client.hub.notifications.clonePushTemplate({Id: args.id} as unknown as Parameters<
      typeof client.hub.notifications.clonePushTemplate
    >[0])
    this.print(`Template ${args.id} cloned.`)
    return res
  }
}
