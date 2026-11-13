import {BaseCommand} from '../../../base.js'

export default class MembershipSettingsPasswordComplexity extends BaseCommand {
  static description = `Show the password rules: length and how many digits, capitals, small letters and symbols

Change them with \`norbix membership settings password-complexity set\`.`

  static examples = [
    '<%= config.bin %> membership settings password-complexity',
    '<%= config.bin %> membership settings password-complexity --json',
  ]

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipSettingsPasswordComplexity)
    const client = this.client(flags)

    const res = await client.hub.membership.getAuthorizationSettings({})
    const rules = res.result?.passwordComplexity ?? {}
    this.print(rules)
    return rules
  }
}
