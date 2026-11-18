import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {explainTrialRefusal, formatTrialAvailability} from '../../../lib/account.js'

export default class AccountTrialAvailability extends BaseCommand {
  static description = `Say whether a free Managed Service trial can start in a region now

Nothing changes: this only reads. Without a region the installation's
default region is checked (the global --region picks the Hub host, not this).

  limitsOn false   no trial limits on this installation: a trial can start
  trialsOpen false the region is full: buy a bundle without a trial, or join
                   the waiting list when waitlistOpen is true
                   (\`norbix account trial waitlist join --consent\`)
  onWaitlist       the account owner's email is already on the waiting list
  refusal          why this account's trial was refused after checkout
                   (CardAlreadyHadTrial: the card already had a trial)

--json prints the whole answer. Region codes: \`norbix account regions\`.`

  static examples = [
    '<%= config.bin %> account trial availability',
    '<%= config.bin %> account trial availability nb-eu-germany',
    '<%= config.bin %> account trial availability nb-eu-germany --json',
  ]

  static args = {
    region: Args.string({description: 'The Norbix region code, for example nb-eu-germany (default: the installation default region)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AccountTrialAvailability)
    const client = this.client(flags, {requireProject: false})

    try {
      const res = await client.hub.account.getTrialAvailability(args.region ? {region: args.region} : {})
      this.print(formatTrialAvailability(res))
      return res
    } catch (error) {
      throw explainTrialRefusal(error, this.commandName)
    }
  }
}
