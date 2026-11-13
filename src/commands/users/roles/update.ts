import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {usageError} from '../../../lib/cli-error.js'
import {listOf} from '../../../lib/membership.js'

export default class UsersRolesUpdate extends BaseCommand {
  static description = `Change a role: its name, description or policies

The command reads the role first and changes only what you pass. --policy is
the complete new list of policies (the ones you leave out are taken off).`

  static examples = [
    '<%= config.bin %> users roles update pr_1_nr_editor --description "Edits orders and products"',
    '<%= config.bin %> users roles update pr_1_nr_editor --policy pol_a,pol_b --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Role ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    name: Flags.string({description: 'New role name'}),
    description: Flags.string({description: 'New description'}),
    policy: Flags.string({description: 'The complete new list of policy IDs (repeat, or a comma list)', multiple: true}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersRolesUpdate)
    const policies = listOf(flags.policy)
    if (flags.name === undefined && flags.description === undefined && !policies) {
      throw usageError('Pass --name, --description or --policy.')
    }

    // Read with a live client: a dry run must still show the merged role.
    const reader = this.client({...flags, 'dry-run': false})
    const current = ((await reader.hub.membership.getRole({id: args.id})) as {role?: {name?: string; description?: string; attachedPolicies?: string[]}}).role ?? {}

    const client = this.client(flags)
    const description = flags.description ?? current.description
    const res = await client.hub.membership.updateRolePolicies({
      id: args.id,
      roleName: flags.name ?? current.name ?? '',
      ...(description === undefined ? {} : {description}),
      policies: policies ?? current.attachedPolicies ?? [],
    })
    this.print(`Role ${args.id} updated.`)
    return res
  }
}
