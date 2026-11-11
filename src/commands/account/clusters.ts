import {BaseCommand} from '../../base.js'
import {formatClusters} from '../../lib/account.js'

export default class AccountClusters extends BaseCommand {
  static description = `List the account's Norbix-managed Atlas clusters

One row per cluster: id, name, region, tier (FLEX or M10), status (Empty,
Provisioning, Active, Failed), how many databases it holds, and the limits it
is close to (NEAR LIMIT; - means none). A last line says so when a new cluster
cannot be created. --json prints the whole answer: every database of a
cluster (project, environment, integration) and its usage (storage,
connections, operations per second). Move a cluster to M10 with
\`norbix account clusters upgrade <flexClusterId>\`.`

  static examples = ['<%= config.bin %> account clusters', '<%= config.bin %> account clusters --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AccountClusters)
    const client = this.client(flags, {requireProject: false})

    const res = await client.hub.account.getFlexClusters({})

    this.print(formatClusters(res))
    return res
  }
}
