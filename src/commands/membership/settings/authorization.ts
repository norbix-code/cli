import {BaseCommand} from '../../../base.js'

export default class MembershipSettingsAuthorization extends BaseCommand {
  static description = `Show the registration settings: default roles, roles allowed at sign-up, guests, invite-only and the password rules

Change them with \`norbix membership settings authorization set\` and
\`norbix membership settings password-complexity set\`.`

  static examples = [
    '<%= config.bin %> membership settings authorization',
    '<%= config.bin %> membership settings authorization --json',
  ]

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipSettingsAuthorization)
    const client = this.client(flags)

    const res = await client.hub.membership.getAuthorizationSettings({})
    this.print(res.result ?? res)
    return res
  }
}
