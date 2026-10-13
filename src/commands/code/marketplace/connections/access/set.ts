import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../../base.js'
import {ACCESS_PACKAGES, accessPackageLabel, parseAccessPackage} from '../../../../../lib/marketplace.js'

export default class CodeMarketplaceConnectionsAccessSet extends BaseCommand {
  static description = `Give a role one access package on a connection

Packages: ${ACCESS_PACKAGES.join(', ')} (case and dashes ignored: read-only works). --manage also gives the Manage package (edit the connection, its secrets, validation and functions); leave it out to take Manage away. Root and Project Admin cannot be changed. Needs membership:managePolicies. The role id is the ROLE ID column of \`connections access\`.`

  static examples = [
    '<%= config.bin %> code marketplace connections access set int_6rBACnEaxQ0x1jTiHtAuWV --role acc_6Qp1dW2kRm8NsT4vYc0Hb_nr_3kLm9QwErTyU --package read-only',
    '<%= config.bin %> code marketplace connections access set int_6rBACnEaxQ0x1jTiHtAuWV --role pr_1JQQeQwmnKcKu4ze5BCKtm_nr_2 --package full-access --manage',
    '<%= config.bin %> code marketplace connections access set int_6rBACnEaxQ0x1jTiHtAuWV --role acc_6Qp1dW2kRm8NsT4vYc0Hb_nr_3kLm9QwErTyU --package none',
    '<%= config.bin %> code marketplace connections access set int_6rBACnEaxQ0x1jTiHtAuWV --role acc_6Qp1dW2kRm8NsT4vYc0Hb_nr_3kLm9QwErTyU --package viewer --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Connection ID (int_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    role: Flags.string({required: true, description: 'Role id (acc_…_nr_… or pr_…_nr_…), from `connections access`'}),
    package: Flags.string({required: true, description: `The package: ${ACCESS_PACKAGES.join(', ')}`}),
    manage: Flags.boolean({default: false, description: 'Also give the Manage package'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceConnectionsAccessSet)
    const pkg = parseAccessPackage(flags.package, 'package')
    const client = this.client(flags)

    const res = await client.hub.code.setMarketplaceIntegrationRoleAccess({
      integrationViewId: args.id,
      roleId: flags.role,
      package: pkg,
      manage: flags.manage,
    } as Parameters<typeof client.hub.code.setMarketplaceIntegrationRoleAccess>[0])

    this.print(`Role ${flags.role} now holds ${accessPackageLabel(pkg)}${flags.manage ? ' + Manage' : ''} on connection ${args.id}.`)
    return res
  }
}
