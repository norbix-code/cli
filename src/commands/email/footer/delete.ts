import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailFooterDelete extends BaseCommand {
  static description = 'Delete an email footer'

  static examples = [
    '<%= config.bin %> email footer delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> email footer delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Footer ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailFooterDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete email footer ${args.id}?`, flags)

    const res = await client.hub.notifications.deleteEmailFooter({id: args.id})

    this.print(`Footer ${args.id} deleted.`)
    return res
  }
}
