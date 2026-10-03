import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PushIntegrationDisable extends BaseCommand {
  static description = 'Turn a push integration off'

  static examples = [
    '<%= config.bin %> push integration disable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
    '<%= config.bin %> push integration disable 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushIntegrationDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Turn off push integration ${args.id}?`, flags)

    // The generated request type calls this field `id`, but the route token is
    // `{Id}` and the transport fills tokens by exact name — passing `id`
    // throws NORBIX_MISSING_PATH_PARAM. Send `Id` until the type is fixed.
    const res = await client.hub.notifications.disablePushIntegration({Id: args.id} as unknown as Parameters<
      typeof client.hub.notifications.disablePushIntegration
    >[0])

    this.print(`Integration ${args.id} disabled.`)
    return res
  }
}
