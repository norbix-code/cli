import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushClone extends BaseCommand {
  static description = "Clone a push template and print the new copy's id"

  static examples = [
    '<%= config.bin %> push clone 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> push clone 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
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
    // The answer carries the new copy's id (gateway 2026-10-23, @norbix.ai/ts 4.37.0);
    // with --json the whole answer `{id}` is printed.
    this.print(res?.id ? `Template ${args.id} cloned as ${res.id}.` : `Template ${args.id} cloned.`)
    return res
  }
}
