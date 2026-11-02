import {BaseCommand} from '../../base.js'
import {formatWorkflowUsage} from '../../lib/workflows.js'

export default class AccountUsage extends BaseCommand {
  static description = `Show usage-based billing for the account

The whole answer, then a table of workflow months: period, runs, step runs. Workflow runs and step runs are counted, not billed. --json prints the answer alone.`

  static examples = ['<%= config.bin %> account usage']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AccountUsage)
    const client = this.client(flags)

    const res = await client.hub.account.getAccountUsageBilling({
    })

    this.print(res)
    const workflows = formatWorkflowUsage(res)
    if (workflows) this.print(`\n${workflows}`)
    return res
  }
}
