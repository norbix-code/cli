import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {UPGRADE_TIER} from '../../../lib/account.js'

export default class AccountClustersUpgrade extends BaseCommand {
  static description = `Move a Norbix-managed Atlas cluster to the M10 tier

Every database on the cluster moves with it, and the price of the cluster
changes. The upgrade is queued, not done at once: \`norbix account clusters\`
shows M10 some minutes later. Cluster ids come from \`norbix account clusters\`.`

  static examples = [
    '<%= config.bin %> account clusters upgrade fxc_2ToIiRM03X63TZaJ2dJdv2 --yes',
    '<%= config.bin %> account clusters upgrade fxc_2ToIiRM03X63TZaJ2dJdv2 --dry-run',
  ]

  static args = {
    flexClusterId: Args.string({required: true, description: 'Cluster ID, from `norbix account clusters`'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AccountClustersUpgrade)
    const client = this.client(flags, {requireProject: false})

    await this.confirmOrFail(
      `Move cluster ${args.flexClusterId} to ${UPGRADE_TIER}? Every database on it moves, and the price of the cluster changes.`,
      flags,
    )

    const res = await client.hub.account.upgradeFlexCluster({flexClusterId: args.flexClusterId, tierCode: UPGRADE_TIER})

    this.print(`Upgrade of cluster ${args.flexClusterId} to ${UPGRADE_TIER} is queued. \`norbix account clusters\` shows ${UPGRADE_TIER} some minutes later.`)
    return res
  }
}
