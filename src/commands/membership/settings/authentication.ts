import {BaseCommand} from '../../../base.js'

export default class MembershipSettingsAuthentication extends BaseCommand {
  static description = `Show the sign-in settings: logout URL, user names allowed, and the logout URL of each sign-in mode

Change them with \`norbix membership settings authentication set\`.`

  static examples = [
    '<%= config.bin %> membership settings authentication',
    '<%= config.bin %> membership settings authentication --json',
  ]

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipSettingsAuthentication)
    const client = this.client(flags)

    const res = await client.hub.membership.getAuthenticationSettings({})
    this.print(res.result ?? res)
    return res
  }
}
