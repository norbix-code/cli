import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailIntegrationConfirmDelivery extends BaseCommand {
  static description = `Confirm that the test e-mail reached a person

Run it after \`email integration test\` once you saw the e-mail in the inbox.`

  static examples = [
    '<%= config.bin %> email integration confirm-delivery 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> email integration confirm-delivery 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailIntegrationConfirmDelivery)
    const client = this.client(flags)

    const res = await client.hub.notifications.confirmEmailIntegrationHumanDelivery({integrationId: args.id})

    this.print(`Delivery confirmed for integration ${args.id}.`)
    return res
  }
}
