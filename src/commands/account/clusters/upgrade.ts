import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AccountClustersUpgrade extends BaseCommand {
  static description = `Move a Norbix-managed Atlas cluster one tier up

The ladder is FLEX → M10 → M20 → M30 → M40, within the plan: a trial stays
on FLEX, Starter goes up to M20, Growth up to M30, Scale up to M40. Without
--tier the cluster moves to its next step (NEXT in \`norbix account clusters\`);
a cluster at its plan's highest tier is refused. Every database on the
cluster moves with it, and the price of the cluster changes. The upgrade is
queued, not done at once: \`norbix account clusters\` shows the new tier
some minutes later. Cluster ids come from \`norbix account clusters\`.`

  static examples = [
    '<%= config.bin %> account clusters upgrade fxc_2ToIiRM03X63TZaJ2dJdv2 --yes',
    '<%= config.bin %> account clusters upgrade fxc_2ToIiRM03X63TZaJ2dJdv2 --tier M20 --yes',
    '<%= config.bin %> account clusters upgrade fxc_2ToIiRM03X63TZaJ2dJdv2 --tier M20 --dry-run',
  ]

  static args = {
    flexClusterId: Args.string({required: true, description: 'Cluster ID, from `norbix account clusters`'}),
  }

  static flags = {
    tier: Flags.string({
      description: 'The tier to move to; it must be the next step (NEXT in `norbix account clusters`). Left out: the next step',
    }),
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AccountClustersUpgrade)
    const client = this.client(flags, {requireProject: false})

    const tier = flags.tier?.toUpperCase()

    await this.confirmOrFail(
      `Move cluster ${args.flexClusterId} to ${tier ?? 'its next tier'}? Every database on it moves, and the price of the cluster changes.`,
      flags,
    )

    const res = await client.hub.account.upgradeFlexCluster({flexClusterId: args.flexClusterId, ...(tier ? {tierCode: tier} : {})})

    const to = tier ?? 'its next tier'
    this.print(`Upgrade of cluster ${args.flexClusterId} to ${to} is queued. \`norbix account clusters\` shows the new tier some minutes later.`)
    return res
  }
}
