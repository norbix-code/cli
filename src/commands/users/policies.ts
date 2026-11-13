import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class UsersPolicies extends BaseCommand {
  static description = `List the project's policies, or show one policy with its permissions

A policy is a set of permissions; roles get policies. Change them with
\`norbix users policies create|update|delete\`.`

  static examples = ['<%= config.bin %> users policies', '<%= config.bin %> users policies pol_database-read --json']

  static args = {
    id: Args.string({required: false, description: 'Policy ID: show this one policy'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersPolicies)
    const client = this.client(flags)

    const res = args.id ? await client.hub.membership.getPolicy({id: args.id}) : await client.hub.membership.getPolicies({})

    this.print(res)
    return res
  }
}
