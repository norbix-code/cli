import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailIntegrationDomainHealth extends BaseCommand {
  static description = `Check the DNS records (SPF, DKIM, DMARC) of an integration's sending domain

Read only — nothing is sent.`

  static examples = ['<%= config.bin %> email integration domain-health 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailIntegrationDomainHealth)
    const client = this.client(flags)

    const res = await client.hub.notifications.checkEmailIntegrationDomainHealth({integrationId: args.id})

    this.print(res)
    return res
  }
}
