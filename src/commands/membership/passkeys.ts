import {BaseCommand} from '../../base.js'

export default class MembershipPasskeys extends BaseCommand {
  static description = `List the passkeys of the signed-in project user

The Api answers for whoever the token belongs to: run it with a project user's
token (--api-key) to see that user's passkeys. Registering, renaming and
revoking a passkey happen in the app, in the browser.`

  static examples = ['<%= config.bin %> membership passkeys --api-key "$PROJECT_USER_TOKEN"', '<%= config.bin %> membership passkeys --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipPasskeys)
    const client = this.client(flags)

    const res = await client.api.membership.listPasskeys({})
    this.print(res)
    return res
  }
}
