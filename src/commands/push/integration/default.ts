import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PushIntegrationDefault extends BaseCommand {
  static description = 'Make a push integration the default one for this project'

  static examples = ['<%= config.bin %> push integration default 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushIntegrationDefault)
    const client = this.client(flags)

    // The generated request type calls this field `id`, but the route token is
    // `{Id}` and the transport fills tokens by exact name — passing `id`
    // throws NORBIX_MISSING_PATH_PARAM. Send `Id` until the type is fixed.
    const res = await client.hub.notifications.setPushIntegrationAsDefault({Id: args.id} as unknown as Parameters<
      typeof client.hub.notifications.setPushIntegrationAsDefault
    >[0])

    this.print(`Integration ${args.id} is now the default.`)
    return res
  }
}
