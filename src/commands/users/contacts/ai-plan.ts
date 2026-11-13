import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class UsersContactsAiPlan extends BaseCommand {
  static description = `Give a contact their own AI plan, or remove it

The contact's own plan wins over the plan of their role and the project's
default plan. With no --plan the contact's own plan is removed.`

  static examples = [
    '<%= config.bin %> users contacts ai-plan ct_66b2f0a1c3d4 --plan aip_pro',
    '<%= config.bin %> users contacts ai-plan ct_66b2f0a1c3d4 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Contact ID (ct_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    plan: Flags.string({description: 'AI plan ID (aip_…); leave out to remove the contact\'s own plan'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersContactsAiPlan)
    const client = this.client(flags)

    const res = await client.hub.membership.setUserAiPlan({userId: args.id, ...(flags.plan ? {planId: flags.plan} : {})})
    this.print(flags.plan ? `Contact ${args.id} now has AI plan ${flags.plan}.` : `Contact ${args.id} has no own AI plan now.`)
    return res
  }
}
