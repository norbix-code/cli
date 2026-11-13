import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {usageError} from '../../../lib/cli-error.js'
import {listOf} from '../../../lib/membership.js'

export default class UsersContactsCreate extends BaseCommand {
  static description = `Add a person (contact) with no login

The contact can get email, SMS and push messages, but cannot sign in. To make a
user who can sign in, use \`norbix users register\` or \`norbix users invite\`.
Pass at least --email or --phone.`

  static examples = [
    '<%= config.bin %> users contacts create --email alice@example.com --name "Alice Smith"',
    '<%= config.bin %> users contacts create --phone +37060000000 --tag lead --tag vip --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    email: Flags.string({description: 'Primary email'}),
    phone: Flags.string({description: 'Primary phone, in international format'}),
    name: Flags.string({description: 'Display name'}),
    'first-name': Flags.string({description: 'First name'}),
    'last-name': Flags.string({description: 'Last name'}),
    tag: Flags.string({description: 'Tag to add (repeat for several, or a comma list)', multiple: true}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(UsersContactsCreate)
    if (!flags.email && !flags.phone) throw usageError('Pass --email or --phone.', 'A contact needs a way to reach the person.')
    const client = this.client(flags)

    const tags = listOf(flags.tag)
    const res = await client.hub.membership.createContact({
      ...(flags.email ? {primaryEmail: flags.email} : {}),
      ...(flags.phone ? {primaryPhone: flags.phone} : {}),
      ...(flags.name ? {displayName: flags.name} : {}),
      ...(flags['first-name'] ? {firstName: flags['first-name']} : {}),
      ...(flags['last-name'] ? {lastName: flags['last-name']} : {}),
      ...(tags ? {tags} : {}),
    })

    const id = (res as {id?: string} | undefined)?.id
    this.print(id ? `Contact ${id} created.` : 'Contact created.')
    return res
  }
}
