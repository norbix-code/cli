import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class UsersContactsAiPlan extends BaseCommand {
  static description = `Show the AI plan a contact gets, and why

Plans are given by role in the project's AI plans (\`project ai plans\`,
\`project ai plans assign\`): the answer names the plan, the reason and the
role it comes from. A contact has no own plan any more.`

  static examples = [
    '<%= config.bin %> users contacts ai-plan ct_66b2f0a1c3d4',
    '<%= config.bin %> users contacts ai-plan ct_66b2f0a1c3d4 --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'Contact ID (ct_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersContactsAiPlan)
    const client = this.client(flags)

    const res = await client.hub.membership.getUserAiPlan({userId: args.id})

    this.print(res)
    return res
  }
}
