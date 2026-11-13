import {BaseCommand} from '../../../base.js'

export default class MembershipSettingsPasskey extends BaseCommand {
  static description = `Show the passkey sign-in settings

Change them with \`norbix membership settings passkey set\`.`

  static examples = ['<%= config.bin %> membership settings passkey', '<%= config.bin %> membership settings passkey --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipSettingsPasskey)
    const client = this.client(flags)

    const res = await client.hub.membership.getPasskeySettings({})
    this.print(res.result ?? res)
    return res
  }
}
