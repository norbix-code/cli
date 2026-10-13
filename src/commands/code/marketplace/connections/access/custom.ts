import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../../base.js'
import {ACCESS_PACKAGES, parseAccessPackage} from '../../../../../lib/marketplace.js'

export default class CodeMarketplaceConnectionsAccessCustom extends BaseCommand {
  static description = `Give a role a custom access policy on a connection

Starts from a package (--from, default None) and adds the tools (--tool, repeat) and the functions (--function func_…, repeat) the role may run. --manage adds the Manage rights. When the role's custom policy for this connection is shared with other roles, the gateway updates it for all of them; --new-policy writes a new one for this role only. Tool names come from \`connections tools\`, function ids from \`functions list\`. Needs membership:managePolicies.`

  static examples = [
    '<%= config.bin %> code marketplace connections access custom int_7Hq2mcpServerGh1Xz9Lw --role acc_6Qp1dW2kRm8NsT4vYc0Hb_nr_3kLm9QwErTyU --from read-only --tool create_issue',
    '<%= config.bin %> code marketplace connections access custom int_7Hq2mcpServerGh1Xz9Lw --role pr_1JQQeQwmnKcKu4ze5BCKtm_nr_2 --tool get_me --function func_4hT8rW2nQ6xLmP0vZ3kJ1c --new-policy',
    '<%= config.bin %> code marketplace connections access custom int_7Hq2mcpServerGh1Xz9Lw --role acc_6Qp1dW2kRm8NsT4vYc0Hb_nr_3kLm9QwErTyU --tool get_me --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Connection ID (int_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    role: Flags.string({required: true, description: 'Role id (acc_…_nr_… or pr_…_nr_…), from `connections access`'}),
    from: Flags.string({default: 'None', description: `The package to start from: ${ACCESS_PACKAGES.join(', ')}`}),
    tool: Flags.string({description: 'A tool name the role may run (repeat for more)', multiple: true}),
    function: Flags.string({description: 'A function id (func_…) of this connection the role may run (repeat for more)', multiple: true}),
    manage: Flags.boolean({default: false, description: 'Also give the Manage rights'}),
    'new-policy': Flags.boolean({default: false, description: "Write a new policy for this role only when its custom policy is shared with other roles"}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceConnectionsAccessCustom)
    const basePackage = parseAccessPackage(flags.from, 'from')
    const client = this.client(flags)

    const res = await client.hub.code.saveMarketplaceIntegrationCustomAccess({
      integrationViewId: args.id,
      roleId: flags.role,
      basePackage,
      tools: flags.tool ?? [],
      functions: flags.function ?? [],
      manage: flags.manage,
      newPolicyForThisRoleOnly: flags['new-policy'],
    } as Parameters<typeof client.hub.code.saveMarketplaceIntegrationCustomAccess>[0])

    const saved = (res ?? {}) as {policyId?: string; created?: boolean; usedByRoles?: number}
    this.print(
      `Custom policy ${saved.policyId ?? ''} ${saved.created ? 'created' : 'updated'} for role ${flags.role} on connection ${args.id}` +
        `${saved.usedByRoles && saved.usedByRoles > 1 ? ` (held by ${saved.usedByRoles} roles)` : ''}.`,
    )
    return res
  }
}
