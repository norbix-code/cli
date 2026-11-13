import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {usageError} from '../../lib/cli-error.js'
import {profileFlags, profileOf} from '../../lib/membership.js'

export default class UsersUpdate extends BaseCommand {
  static description = `Change the profile of a login

The gateway replaces the whole profile, so the command reads the login first
and changes only the fields you pass. Sent to the Api host (the developer
path). To change a person's profile, \`norbix users contacts update\` is the
same on the contact.`

  static examples = [
    '<%= config.bin %> users update usr_66b2f0a1c3d4 --name "Alice Smith"',
    '<%= config.bin %> users update usr_66b2f0a1c3d4 --language lt --time-zone Europe/Vilnius --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Login ID (usr_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    ...profileFlags,
    phone: Flags.string({description: 'Phone, in international format'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersUpdate)
    const changes: Record<string, string> = {...profileOf(flags), ...(flags.phone ? {phone: flags.phone} : {})}
    if (Object.keys(changes).length === 0) throw usageError('Pass at least one field to change, e.g. --name.')

    // Read with a live client: a dry run must still show the merged profile.
    const reader = this.client({...flags, 'dry-run': false})
    const current = (await reader.api.membership.getUser({id: args.id})) as {user?: {generalInfo?: Record<string, unknown>}}
    const userGeneralInfo = {blockAllMarketingMessages: false, ...current.user?.generalInfo, ...changes}

    const client = this.client(flags)
    const res = await client.api.membership.updateUser({
      id: args.id,
      ignoreUserRegistersAsRole: false,
      userGeneralInfo: userGeneralInfo as never,
    })
    this.print(`Login ${args.id} updated.`)
    return res
  }
}
