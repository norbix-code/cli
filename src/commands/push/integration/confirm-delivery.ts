import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PushIntegrationConfirmDelivery extends BaseCommand {
  static description = `Confirm that a test push reached a real person

After \`push integration test\`, run this once you have seen the push on the
device. It marks the integration as proven to deliver.`

  static examples = [
    '<%= config.bin %> push integration confirm-delivery 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> push integration confirm-delivery 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushIntegrationConfirmDelivery)
    const client = this.client(flags)

    const res = await client.hub.notifications.confirmPushIntegrationHumanDelivery({integrationId: args.id})

    this.print(`Delivery confirmed for integration ${args.id}.`)
    return res
  }
}
