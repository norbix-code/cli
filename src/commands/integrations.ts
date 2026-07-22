import {Norbix} from '@norbix.ai/ts'
import {Args} from '@oclif/core'

import {BaseCommand} from '../base.js'

const MODULES: Record<string, (c: Norbix) => Promise<unknown>> = {
  code: (c) => c.hub.code.getCodeIntegrations({}),
  database: (c) => c.hub.database.getDatabaseIntegrations({}),
  email: (c) => c.hub.notifications.getEmailIntegrations({}),
  files: (c) => c.hub.files.getFilesIntegrations({}),
  logs: (c) => c.hub.logs.getLoggingIntegrations({}),
  membership: (c) => c.hub.membership.getMembershipIntegrations({}),
  payments: (c) => c.hub.payments.getPaymentsIntegrations({}),
  push: (c) => c.hub.notifications.getPushIntegrations({}),
  sms: (c) => c.hub.notifications.getSmsIntegrations({}),
}

export default class Integrations extends BaseCommand {
  static description = 'List the integrations of one module'

  static examples = [
    '<%= config.bin %> integrations database',
    '<%= config.bin %> integrations email',
  ]

  static args = {
    module: Args.string({
      required: true,
      description: `One of: ${Object.keys(MODULES).sort().join(', ')}`,
      options: Object.keys(MODULES).sort(),
    }),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(Integrations)
    const client = this.client(flags)

    const res = await MODULES[args.module](client)
    this.print(res)
    return res
  }
}
