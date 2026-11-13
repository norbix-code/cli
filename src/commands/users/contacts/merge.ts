import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class UsersContactsMerge extends BaseCommand {
  static description = `Merge contacts into one

The first contact stays; the logins and history of the others move to it and
the others are archived. This cannot be undone.`

  static strict = false

  static examples = [
    '<%= config.bin %> users contacts merge ct_keep ct_dup1 ct_dup2 --yes',
    '<%= config.bin %> users contacts merge ct_keep ct_dup1 --dry-run',
  ]

  static args = {
    survivor: Args.string({required: true, description: 'Contact ID that stays (ct_…)'}),
    merged: Args.string({required: true, description: 'Contact ID(s) to merge into it (ct_…, one or more)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, argv, flags} = await this.parse(UsersContactsMerge)
    const mergedIds = (argv as string[]).slice(1)
    const client = this.client(flags)
    await this.confirmOrFail(`Merge ${mergedIds.join(', ')} into ${args.survivor}? The others are archived; this cannot be undone.`, flags)

    const res = await client.hub.membership.mergeContacts({survivorId: args.survivor, mergedIds})
    this.print(`Merged ${mergedIds.join(', ')} into ${args.survivor}.`)
    return res
  }
}
