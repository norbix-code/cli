import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {usageError} from '../../../../lib/cli-error.js'
import {bindingsFlag, bindingsOf} from '../../../../lib/membership-email.js'

export default class MembershipSettingsWelcomeEmailSet extends BaseCommand {
  static description = `Choose the welcome e-mail of this environment, or turn it off

The welcome e-mail goes to a person who signs up with an e-mail address. --off
sends none in this environment (a sign-up trigger may send it instead).
\`norbix membership settings authorization\` shows the choice, and
"welcomeEmailTriggers" lists enabled sign-up triggers that already e-mail the
new user (two welcome e-mails). The template's tokens that Norbix does not fill
need a value (--bindings); see them first with
\`norbix membership settings email-bindings Welcome --template <id>\`.`

  static examples = [
    '<%= config.bin %> membership settings welcome-email set --template tmpl_66b2f0a1',
    `<%= config.bin %> membership settings welcome-email set --template tmpl_66b2f0a1 --bindings '[{"token":"Order.Number","kind":"Empty"}]'`,
    '<%= config.bin %> membership settings welcome-email set --off --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    template: Flags.string({description: 'The welcome e-mail template (tmpl_…)', exclusive: ['off']}),
    off: Flags.boolean({description: 'Send no welcome e-mail in this environment', default: false, exclusive: ['template', 'bindings']}),
    bindings: bindingsFlag,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipSettingsWelcomeEmailSet)
    if (!flags.template && !flags.off) throw usageError('Pass --template <tmpl_…> or --off.')
    const bindings = flags.bindings ? await bindingsOf(flags.bindings) : undefined
    const client = this.client(flags)

    const res = await client.hub.membership.updateAuthorizationSettings({
      setting: 'RegistrationTemplate',
      welcomeEmailTemplate: flags.off ? '' : flags.template,
      ...(bindings ? {bindings} : {}),
    } as never)
    this.print(flags.off ? 'Welcome e-mail turned off in this environment.' : `Welcome e-mail set to ${flags.template}.`)
    return res
  }
}
