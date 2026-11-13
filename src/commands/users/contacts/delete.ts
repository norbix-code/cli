import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class UsersContactsDelete extends BaseCommand {
  static description = `Archive a contact (soft delete)

The contact is hidden from lists; its history is kept. Check the ID with
\`norbix users contacts get\` first.`

  static examples = [
    '<%= config.bin %> users contacts delete ct_66b2f0a1c3d4 --yes',
    '<%= config.bin %> users contacts delete ct_66b2f0a1c3d4 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Contact ID (ct_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersContactsDelete)
    const client = this.client(flags)
    await this.confirmOrFail(`Archive contact ${args.id}? It is hidden from every list.`, flags)

    const res = await client.hub.membership.deleteContact({contactId: args.id})
    this.print(`Contact ${args.id} archived.`)
    return res
  }
}
