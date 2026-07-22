import {BaseCommand} from '../../base.js'

export default class PaymentsTriggers extends BaseCommand {
  static description = 'List payment triggers'

  static examples = ['<%= config.bin %> payments triggers']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PaymentsTriggers)
    const client = this.client(flags)

    const res = await client.hub.payments.getPaymentsTriggers({
    })

    this.print(res)
    return res
  }
}
