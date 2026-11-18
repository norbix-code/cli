import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {explainTrialRefusal, formatTrialWaitlist} from '../../../../lib/account.js'

export default class AccountTrialWaitlistJoin extends BaseCommand {
  static description = `Put the account owner's email on the free-trial waiting list

When a region is full, Norbix keeps a waiting list. When a trial slot frees,
Norbix emails the account owner an invitation link, valid a few days. The
owner agrees to that email with --consent; without it nothing is sent.

The answer's status is added, alreadyListed (the email is already on the
list) or alreadyCustomer (the email already had a trial or a subscription).
A switched-off list is refused with CM-ERRORS-ACCOUNT-044, an unknown region
with CM-ERRORS-ACCOUNT-043. Check first with \`norbix account trial availability\`.`

  static examples = [
    '<%= config.bin %> account trial waitlist join --consent',
    '<%= config.bin %> account trial waitlist join nb-eu-germany --consent --consent-version 2026-11',
    '<%= config.bin %> account trial waitlist join nb-eu-germany --consent --dry-run',
  ]

  static args = {
    region: Args.string({description: 'The Norbix region code, for example nb-eu-germany (optional; without it the email is listed with no region)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    consent: Flags.boolean({description: 'The account owner agrees to get the invitation email (required)', default: false}),
    'consent-version': Flags.string({description: 'The version of the consent text the owner agreed to'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AccountTrialWaitlistJoin)
    if (!flags.consent) {
      this.error(
        "Pass --consent: the account owner must agree to get the invitation email before their email goes on the waiting list. Nothing was sent.",
      )
    }

    const client = this.client(flags, {requireProject: false})
    const request: {region?: string; consent: boolean; consentVersion?: string} = {consent: true}
    if (args.region) request.region = args.region
    if (flags['consent-version']) request.consentVersion = flags['consent-version']

    try {
      const res = await client.hub.account.joinTrialWaitlist(request)
      this.print(formatTrialWaitlist(res))
      return res
    } catch (error) {
      throw explainTrialRefusal(error, this.commandName)
    }
  }
}
