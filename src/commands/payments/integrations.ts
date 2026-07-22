import {BaseCommand} from '../../base.js'

export default class PaymentsIntegrations extends BaseCommand {
  static description = 'List payment integrations'

  static examples = ['<%= config.bin %> payments integrations']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PaymentsIntegrations)
    const client = this.client(flags)

    const res = await client.hub.payments.getPaymentsIntegrations({
    })

    this.print(res)
    return res
  }
}
