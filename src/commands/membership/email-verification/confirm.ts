import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class MembershipEmailVerificationConfirm extends BaseCommand {
  static description = `Confirm an e-mail address with the token from a verification link

The verification e-mail links to your app's "confirm your e-mail" page with
#token=…; this sends that token, as the app does. Works once; a newer link
replaces older ones. Answers the login id (usr_…) and when it was verified.
Public: no sign-in is needed. Useful to test the flow with the Fake e-mail
integration (read the e-mail with \`norbix email\` / the Fake messages).`

  static examples = [
    '<%= config.bin %> membership email-verification confirm 7h3Kq…token-from-the-link',
    '<%= config.bin %> membership email-verification confirm 7h3Kq… --env TEST --json',
    '<%= config.bin %> membership email-verification confirm 7h3Kq… --dry-run',
  ]

  static args = {
    token: Args.string({required: true, description: 'The token from the link (the part after #token=)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(MembershipEmailVerificationConfirm)
    const client = this.client(flags)
    const res = await client.api.membership.verifyEmailAddress({token: args.token})
    this.print(`E-mail verified for ${res.authId ?? 'the login'} at ${res.verifiedAtUtc ?? 'now'}.`)
    return res
  }
}
