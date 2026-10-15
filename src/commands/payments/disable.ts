import {BaseCommand} from '../../base.js'

export default class PaymentsDisable extends BaseCommand {
  static description = `Turn off the Payments module for the project

Incoming provider webhooks stop firing triggers; the integrations, triggers
and the webhook log are kept. Up to 1.33 this command took a trigger ID —
that is now \`payments trigger disable <id>\`.`

  static examples = [
    '<%= config.bin %> payments disable --yes',
    '<%= config.bin %> payments disable --dry-run',
  ]

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PaymentsDisable)
    const client = this.client(flags)
    await this.confirmOrFail('Turn off the Payments module?', flags)

    const res = await client.hub.payments.disablePayments({})

    this.print('Payments disabled.')
    return res
  }
}
