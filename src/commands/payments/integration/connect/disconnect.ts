import {Args} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

export default class PaymentsIntegrationConnectDisconnect extends BaseCommand {
  static description = `End the quick connection of a payments integration

The provider's webhooks are removed (best effort), the stored key is forgotten
and the integration is turned off. Its connection record stays, so
\`connect start --integration <id>\` can reconnect it. The answer says whether
it was connected (wasConnected) and whether the provider could be reached to
remove its webhooks (providerAnswered — when false, remove them in the
provider's admin).`

  static examples = [
    '<%= config.bin %> payments integration connect disconnect 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> payments integration connect disconnect 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PaymentsIntegrationConnectDisconnect)
    const client = this.client(flags)

    await this.confirmOrFail(`Disconnect payments integration ${args.id}? It is turned off and its key forgotten.`, flags)

    const res = await client.hub.payments.disconnectPaymentsIntegrationConnect({id: args.id})

    this.print(res)
    return res
  }
}
