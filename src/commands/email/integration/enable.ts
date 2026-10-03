import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailIntegrationEnable extends BaseCommand {
  static description = 'Turn an email integration on'

  static examples = ['<%= config.bin %> email integration enable 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailIntegrationEnable)
    const client = this.client(flags)

    const res = await client.hub.notifications.enableEmailIntegration({id: args.id})

    this.print(`Integration ${args.id} enabled.`)
    return res
  }
}
