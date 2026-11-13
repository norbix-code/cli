import {BaseCommand} from '../../base.js'

export default class MembershipPasskeys extends BaseCommand {
  static description = `List the passkeys of the user the call is signed in as

The Api answers only for the owner of the token, so under an account sign-in
or a service-user key the list is usually empty. Registering, renaming and
revoking a passkey happen in the app, in the browser.`

  static examples = ['<%= config.bin %> membership passkeys', '<%= config.bin %> membership passkeys --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipPasskeys)
    const client = this.client(flags)

    const res = await client.api.membership.listPasskeys({})
    this.print(res)
    return res
  }
}
