import {BaseCommand} from '../../base.js'

export default class AccountStatus extends BaseCommand {
  static description = `Show the account status (plan, verification, limits)

The whole answer is printed. For a Managed Service account it carries the
bundle and billing period (bundle, billingPeriod), whether it is a trial
(isTrial), when it renews (renewsOn), and how many projects are enabled out
of the bundle's limit (enabledProjects, projectCap).`

  static examples = ['<%= config.bin %> account status']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AccountStatus)
    const client = this.client(flags, {requireProject: false})

    const res = await client.hub.account.getAccountStatus({
    })

    this.print(res)
    return res
  }
}
