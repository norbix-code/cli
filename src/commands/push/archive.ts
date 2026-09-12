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

    // The route token is `{Id}` and the transport fills tokens by exact name,
    // so the request must carry `Id`. The generated type calls the field `id`,
    // which throws NORBIX_MISSING_PATH_PARAM — hence the cast.
    const res = await client.hub.notifications.archivePushTemplate({Id: args.id} as unknown as Parameters<
      typeof client.hub.notifications.archivePushTemplate
    >[0])
    this.print(`Template ${args.id} archived.`)
    return res
  }
}
