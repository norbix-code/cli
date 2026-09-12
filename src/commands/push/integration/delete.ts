import {confirm} from '@inquirer/prompts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PushIntegrationDelete extends BaseCommand {
  static description = 'Delete a push integration'

  static examples = ['<%= config.bin %> push integration delete 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushIntegrationDelete)
    const client = this.client(flags)

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({message: `Delete push integration ${args.id}?`, default: false})
      if (!ok) return this.print('Cancelled.')
    }

    // The generated request type calls this field `id`, but the route token is
    // `{Id}` and the transport fills tokens by exact name — passing `id`
    // throws NORBIX_MISSING_PATH_PARAM. Send `Id` until the type is fixed.
    const res = await client.hub.notifications.deletePushIntegration({Id: args.id} as unknown as Parameters<
      typeof client.hub.notifications.deletePushIntegration
    >[0])

    this.print(`Integration ${args.id} deleted.`)
    return res
  }
}
