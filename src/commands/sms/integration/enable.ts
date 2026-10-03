import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class SmsIntegrationEnable extends BaseCommand {
  static description = 'Turn an SMS integration on'

  static examples = ['<%= config.bin %> sms integration enable 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsIntegrationEnable)
    const client = this.client(flags)

    // The route token is `{Id}`; the SDK (4.2.0) fills it from `id` — the
    // lookup is case-insensitive — so the generated field is enough.
    const res = await client.hub.notifications.enableSmsIntegration({id: args.id})

    this.print(`Integration ${args.id} enabled.`)
    return res
  }
}
