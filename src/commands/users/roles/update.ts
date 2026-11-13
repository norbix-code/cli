import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {usageError} from '../../../lib/cli-error.js'
import {READ_FIRST_DRY_RUN, listOf, nothingRead} from '../../../lib/membership.js'

export default class UsersRolesUpdate extends BaseCommand {
  static description = `Change a role: its name, description or policies

The command reads the role first and changes only what you pass. --policy is
the complete new list of policies (the ones you leave out are taken off).

${READ_FIRST_DRY_RUN}`

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

    const client = this.client(flags)
    // The gateway clears the policies and the description when they are left out, so they are always sent.
    let current: {name?: string; description?: string; attachedPolicies?: string[]} = {}
    if (!flags['dry-run']) {
      const read = ((await client.hub.membership.getRole({id: args.id})) as {role?: typeof current} | undefined)?.role
      if (!read?.name) throw nothingRead(`role ${args.id}`, 'Check the ID with `norbix users roles`.')
      current = read
    }

    const description = flags.description ?? current.description
    const res = await client.hub.membership.updateRolePolicies({
      id: args.id,
      roleName: (flags.name ?? current.name) as string,
      ...(description === undefined ? {} : {description}),
      ...(policies || !flags['dry-run'] ? {policies: policies ?? current.attachedPolicies ?? []} : {}),
    })
    this.print(`Role ${args.id} updated.`)
    return res
  }
}
