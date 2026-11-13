import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class UsersPoliciesDelete extends BaseCommand {
  static description = `Delete a policy; the roles that had it lose its permissions

Built-in policies cannot be deleted. This cannot be undone.`

  static examples = ['<%= config.bin %> users policies delete pol_3kJ9xJ2mQ0aB --yes', '<%= config.bin %> users policies delete pol_3kJ9xJ2mQ0aB --dry-run']

  static args = {
    id: Args.string({required: true, description: 'Policy ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersPoliciesDelete)
    const client = this.client(flags)
    await this.confirmOrFail(`Delete policy ${args.id}? Roles that have it lose its permissions.`, flags)

    const res = await client.hub.membership.deletePolicy({id: args.id})
    this.print(`Policy ${args.id} deleted.`)
    return res
  }
}
