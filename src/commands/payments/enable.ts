import {BaseCommand} from '../../base.js'

export default class PaymentsEnable extends BaseCommand {
  static description = `Turn on the Payments module for the project

Up to 1.33 this command took a trigger ID and turned a payment trigger on —
that is now \`payments trigger enable <id>\`.`

  static examples = [
    '<%= config.bin %> payments enable',
    '<%= config.bin %> payments enable --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PaymentsEnable)
    const client = this.client(flags)

    const res = await client.hub.payments.enablePayments({})

    this.print('Payments enabled.')
    return res
  }
}
