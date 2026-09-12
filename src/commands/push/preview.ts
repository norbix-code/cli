import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushPreview extends BaseCommand {
  static description = `Render the title, body and subtitle behind a push preview link

The hash is the opaque value the backend puts in a preview link — you cannot
build it yourself, so copy it out of the link.`

  static examples = ['<%= config.bin %> push preview 8f2a91c4...']

  static args = {
    hash: Args.string({required: true, description: 'Preview hash from the preview link'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushPreview)
    const client = this.client(flags)

    const res = await client.hub.notifications.previewPushNotification({hash: args.hash})

    this.print(res)
    return res
  }
}
