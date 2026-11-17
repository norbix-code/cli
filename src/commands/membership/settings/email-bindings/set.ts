import {Args} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {MEMBERSHIP_EMAILS, bindingsOf, requiredBindingsFlag} from '../../../../lib/membership-email.js'

export default class MembershipSettingsEmailBindingsSet extends BaseCommand {
  static description = `Save the values of a membership e-mail's tokens that Norbix does not fill

The list replaces the stored bindings of that e-mail. The gateway refuses the
save (CM-ERRORS-MEMBERSHIP-060) while a token of the chosen template still has
no value; see them with \`norbix membership settings email-bindings <setting>\`.
A binding is {"token", "kind": Fixed | Field | Empty, "value", "translations"}:
Fixed = the text (one per language in "translations", else "value"), Field = a
field of the event ("fields" in the list answer), Empty = send it empty.`

  static examples = [
    `<%= config.bin %> membership settings email-bindings set Welcome --bindings '[{"token":"Order.Number","kind":"Empty"}]'`,
    '<%= config.bin %> membership settings email-bindings set Invitation --bindings @bindings.json --dry-run',
  ]

  static args = {
    setting: Args.string({description: 'Which e-mail', options: [...MEMBERSHIP_EMAILS], required: true}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    bindings: requiredBindingsFlag,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(MembershipSettingsEmailBindingsSet)
    const bindings = await bindingsOf(flags.bindings)
    const client = this.client(flags)

    // The SDK types needVerification, allowInviteUsers, … as required; the gateway reads only
    // the fields of the named setting, so only those are sent.
    const res = await client.hub.membership.updateAuthorizationSettings({
      setting: 'EmailBindings',
      bindingsEvent: args.setting,
      bindings,
    } as never)
    this.print(`Token values of the ${args.setting} e-mail saved.`)
    return res
  }
}
