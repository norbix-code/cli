import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailClone extends BaseCommand {
  static description = "Clone an email template and print the new copy's id"

  static examples = [
    '<%= config.bin %> email clone 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> email clone 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailClone)
    const client = this.client(flags)

    const res = await client.hub.notifications.cloneEmailTemplate({id: args.id})
    // The answer carries the new copy's id (gateway 2026-10-23, @norbix.ai/ts 4.37.0);
    // with --json the whole answer `{id}` is printed.
    this.print(res?.id ? `Template ${args.id} cloned as ${res.id}.` : `Template ${args.id} cloned.`)
    return res
  }
}
