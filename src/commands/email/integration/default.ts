import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailIntegrationDefault extends BaseCommand {
  static description = 'Make an email integration the project default (campaigns use it when they name none)'

  static examples = ['<%= config.bin %> email integration default 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailIntegrationDefault)
    const client = this.client(flags)

    const res = await client.hub.notifications.setEmailsIntegrationAsDefault({id: args.id})

    this.print(`Integration ${args.id} is now the default.`)
    return res
  }
}
