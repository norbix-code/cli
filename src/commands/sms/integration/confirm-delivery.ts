import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class SmsIntegrationConfirmDelivery extends BaseCommand {
  static description = `Confirm that a test SMS reached a real person

After \`sms integration test\`, run this once you have seen the SMS on the
phone. It marks the integration as proven to deliver.`

  static examples = ['<%= config.bin %> sms integration confirm-delivery 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsIntegrationConfirmDelivery)
    const client = this.client(flags)

    const res = await client.hub.notifications.confirmSmsIntegrationHumanDelivery({integrationId: args.id})

    this.print(`Delivery confirmed for integration ${args.id}.`)
    return res
  }
}
