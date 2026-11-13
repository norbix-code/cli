import {BaseCommand} from '../../../../base.js'
import {boolFlag} from '../../../../lib/membership.js'

export default class MembershipSettingsAuthenticationSet extends BaseCommand {
  static description = `Change the sign-in settings

The only sign-in setting is whether users may sign in with a user name as well
as an email, so the command sends it as given; nothing is read first.`

  static examples = [
    '<%= config.bin %> membership settings authentication set --allow-usernames true',
    '<%= config.bin %> membership settings authentication set --allow-usernames false --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    'allow-usernames': {...boolFlag('Let users sign in with a user name as well as an email'), required: true},
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipSettingsAuthenticationSet)
    const client = this.client(flags)

    const res = await client.hub.membership.updateAuthenticationSettings({
      allowUsernames: flags['allow-usernames'] === 'true',
    })
    this.print('Sign-in settings saved.')
    return res
  }
}
