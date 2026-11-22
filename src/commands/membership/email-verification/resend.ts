import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class MembershipEmailVerificationResend extends BaseCommand {
  static description = `Send the e-mail verification link again

A new link replaces the old one. It is sent only to an e-mail + password login
whose address is not verified yet, while verification e-mails are on, and at
most once a minute per login. The answer is always OK, whether or not the
address exists — the same answer an app gets. Public: no sign-in is needed.`

  static examples = [
    '<%= config.bin %> membership email-verification resend klientas@example.com',
    '<%= config.bin %> membership email-verification resend klientas@example.com --env TEST',
    '<%= config.bin %> membership email-verification resend klientas@example.com --dry-run',
  ]

  static args = {
    email: Args.string({required: true, description: 'The address the user signed up with'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(MembershipEmailVerificationResend)
    const client = this.client(flags)
    const res = await client.api.membership.resendEmailAddressVerification({email: args.email})
    this.print('Done. If that address waits for verification, a new link is on its way.')
    return res
  }
}
