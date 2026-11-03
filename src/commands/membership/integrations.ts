import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class MembershipIntegrations extends BaseCommand {
  static description = `List the membership integrations set up for this project: the sign-in providers the project's users may log in with (Google, Apple, GitHub, Okta, …)`

  static examples = ['<%= config.bin %> membership integrations', '<%= config.bin %> membership integrations --page-size 50']

  static flags = {
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipIntegrations)
    const client = this.client(flags)

    const res = await client.hub.membership.getMembershipIntegrations({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
