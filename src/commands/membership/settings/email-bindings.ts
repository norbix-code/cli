import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {MEMBERSHIP_EMAILS} from '../../../lib/membership-email.js'

export default class MembershipSettingsEmailBindings extends BaseCommand {
  static description = `List the tokens of a membership e-mail template and how each one gets its value

Every token is Auto (Norbix fills it — "source" says with what), NeedsValue (a
binding must give it a value: Fixed text, a Field of the event, or Empty) or
NotAvailable (never filled for this e-mail — "reason" says why).
"withoutValueCount" above 0 means a save of this e-mail's template is refused
(CM-ERRORS-MEMBERSHIP-060) until every token has a value. Give the values with
\`norbix membership settings email-bindings set\`.`

  static examples = [
    '<%= config.bin %> membership settings email-bindings Welcome',
    '<%= config.bin %> membership settings email-bindings PasswordReset --template tmpl_66b2f0a1 --json',
  ]

  static args = {
    setting: Args.string({description: 'Which e-mail', options: [...MEMBERSHIP_EMAILS], required: true}),
  }

  static flags = {
    template: Flags.string({description: 'The template about to be chosen (tmpl_…); default: the one chosen now, else the built-in'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(MembershipSettingsEmailBindings)
    const client = this.client(flags)

    const res = await client.hub.membership.getMembershipEmailBindings({
      setting: args.setting,
      ...(flags.template ? {templateId: flags.template} : {}),
    })
    this.print(res.result ?? res)
    return res
  }
}
