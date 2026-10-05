import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AccountMeSetPhone extends BaseCommand {
  static description = `Save or clear your own phone number

E.164 format: + and the country code, then digits (+37060000000). "Account
users" SMS campaigns send to this number; a team member without one is
skipped. There is no user ID: it is always the signed-in person's own phone.`

  static examples = [
    '<%= config.bin %> account me set-phone +37060000000',
    '<%= config.bin %> account me set-phone --clear',
    '<%= config.bin %> account me set-phone +37060000000 --dry-run',
  ]

  static args = {
    phone: Args.string({description: 'Phone number in E.164 format, e.g. +37060000000'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    clear: Flags.boolean({description: 'Remove your phone number', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AccountMeSetPhone)
    if (args.phone && flags.clear) this.error('Pass a phone number or --clear, not both.')
    if (!args.phone && !flags.clear) this.error('Pass a phone number (+37060000000), or --clear to remove it.')

    const client = this.client(flags)
    // An empty string clears the number on the server (Hub.Account/Account/Me/UpdateMyPhone.cs).
    const res = await client.hub.account.updateMyAccountUserPhone({phone: flags.clear ? '' : args.phone})

    this.print(flags.clear ? 'Phone number cleared.' : `Phone number set to ${args.phone}.`)
    return res
  }
}
