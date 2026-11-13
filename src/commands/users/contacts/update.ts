import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {usageError} from '../../../lib/cli-error.js'
import {profileFlags, profileOf} from '../../../lib/membership.js'

export default class UsersContactsUpdate extends BaseCommand {
  static description = `Change a contact's profile

Only the fields you pass change; the others keep their values.`

  static examples = [
    '<%= config.bin %> users contacts update ct_66b2f0a1c3d4 --name "Alice Smith" --language lt',
    '<%= config.bin %> users contacts update ct_66b2f0a1c3d4 --city Vilnius --country LT --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Contact ID (ct_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    ...profileFlags,
    'full-name': Flags.string({description: 'Full name'}),
    'address-line1': Flags.string({description: 'Address, first line'}),
    'address-line2': Flags.string({description: 'Address, second line'}),
    state: Flags.string({description: 'State or region'}),
    'postal-code': Flags.string({description: 'Postal code'}),
    gender: Flags.string({description: 'Gender', options: ['Male', 'Female', 'Other']}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersContactsUpdate)
    const fields: Record<string, string> = {
      ...profileOf(flags),
      ...(flags['full-name'] ? {fullName: flags['full-name']} : {}),
      ...(flags['address-line1'] ? {addressLine1: flags['address-line1']} : {}),
      ...(flags['address-line2'] ? {addressLine2: flags['address-line2']} : {}),
      ...(flags.state ? {state: flags.state} : {}),
      ...(flags['postal-code'] ? {postalCode: flags['postal-code']} : {}),
      ...(flags.gender ? {gender: flags.gender} : {}),
    }
    if (Object.keys(fields).length === 0) throw usageError('Pass at least one field to change, e.g. --name.')

    const client = this.client(flags)
    const res = await client.hub.membership.updateContact({contactId: args.id, ...fields})
    this.print(`Contact ${args.id} updated.`)
    return res
  }
}
