import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class PushDelete extends BaseCommand {
  static description = 'Delete a push template'

  static examples = ['<%= config.bin %> push delete 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete push template ${args.id}?`, flags)

    // The route token is `{Id}` and the transport fills tokens by exact name,
    // so the request must carry `Id`. The generated type calls the field `id`,
    // which throws NORBIX_MISSING_PATH_PARAM — hence the cast.
    const res = await client.hub.notifications.deletePushTemplate({Id: args.id} as unknown as Parameters<
      typeof client.hub.notifications.deletePushTemplate
    >[0])
    this.print(`Template ${args.id} deleted.`)
    return res
  }
}
